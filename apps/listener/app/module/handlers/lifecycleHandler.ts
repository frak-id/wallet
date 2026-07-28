import type { FrakLifecycleEvent } from "@frak-labs/core-sdk";
import { decompressJsonFromB64 } from "@frak-labs/core-sdk";
import type {
    LifecycleHandler,
    RpcRequestContext,
} from "@frak-labs/frame-connector";
import {
    trackEvent,
    updateGlobalProperties,
} from "@frak-labs/wallet-shared/common/analytics";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/common/utils/lifecycleEvents";
import { clientIdStore } from "@frak-labs/wallet-shared/stores/clientIdStore";
import type { SdkSession, Session } from "@frak-labs/wallet-shared/types";
import {
    enqueueI18nOverride,
    enqueueLanguageChange,
} from "@/i18nOverrideQueue";
import {
    iframeClientId,
    resolvingContextStore,
} from "@/module/stores/resolvingContextStore";
import type { ResolvedSdkConfig } from "@/module/stores/types";
import { restoreBackupData } from "@/module/utils/backup";
import { processSsoCompletion } from "./ssoHandler";

/**
 * Client lifecycle handler for the RPC listener.
 *
 * Heartbeats trigger an `emitConnected()` — this is the fallback discovery
 * path for the SDK (the primary push path is the `emitConnected()` call in the
 * React effect on mount). Both paths emit the same idempotent
 * `iframeLifecycle: "connected"` event.
 */
export const clientLifecycleHandler: LifecycleHandler<
    FrakLifecycleEvent
> = async (messageEvent, context) => {
    if (!("clientLifecycle" in messageEvent)) return;
    const { clientLifecycle: event, data } = messageEvent;

    switch (event) {
        case "modal-css": {
            applyModalCss(data.cssLink);
            return;
        }

        case "modal-i18n": {
            const override = data.i18n;
            if (
                !override ||
                typeof override !== "object" ||
                Object.keys(override).length === 0
            ) {
                return;
            }
            // Queue the override — it'll either apply immediately if the
            // UI runtime is mounted, or wait until `mountUiRuntime` drains
            // the queue. Keeps i18next out of the eager bundle.
            enqueueI18nOverride(override);
            return;
        }

        case "restore-backup": {
            await handleRestoreBackup(data.backup, context);
            return;
        }

        case "heartbeat": {
            // Fallback discovery path: SDK is polling until it hears back.
            emitConnected();
            return;
        }

        case "resolved-config": {
            await handleResolvedConfig(data, context);
            return;
        }

        case "sso-redirect-complete": {
            // Handle SSO redirect completion from SDK
            await handleSsoRedirectComplete(data);
            return;
        }
    }
};

/**
 * Emit the "connected" lifecycle event so the SDK knows we're alive.
 * Context is established later by the resolved-config lifecycle message.
 */
export function emitConnected(): void {
    if (typeof window === "undefined") return;
    emitLifecycleEvent({ iframeLifecycle: "connected" });
}

async function handleRestoreBackup(
    backup: string,
    context: RpcRequestContext
): Promise<void> {
    const domain = extractDomain(context.origin);
    if (!domain) {
        console.warn(
            "Can't restore backup: unable to extract domain from origin"
        );
        return;
    }
    await restoreBackupData({ backup, domain });
}

const BACKEND_CSS_STYLE_ID = "frak-backend-css";
const MODAL_CSS_LINK_ID = "frak-modal-css";

/**
 * Validate a merchant-supplied stylesheet URL before injecting it as a
 * `<link rel="stylesheet">`. The link is attacker-influenceable (it rides in
 * on an unauthenticated `modal-css` lifecycle message), so we constrain it to
 * an absolute `https:` URL whose path ends in `.css` — matching the SDK
 * `customizations.css` contract (`${string}.css`). This rejects `javascript:`,
 * `data:`, `http:`, and protocol-relative (`//host`) vectors while still
 * letting merchants host their own CSS on any https origin.
 */
function isSafeCssLink(cssLink: unknown): cssLink is string {
    if (typeof cssLink !== "string") return false;
    try {
        const url = new URL(cssLink);
        if (url.protocol !== "https:") return false;
        return url.pathname.toLowerCase().endsWith(".css");
    } catch {
        return false;
    }
}

/**
 * Inject the merchant's modal stylesheet, once validated. Replaces any
 * previously-injected modal CSS link so repeated `modal-css` messages don't
 * stack up `<link>` nodes in `<head>`.
 */
function applyModalCss(cssLink: unknown): void {
    if (!isSafeCssLink(cssLink)) {
        console.warn(
            "[Frak] Ignoring modal-css: cssLink is not a valid https .css URL"
        );
        return;
    }

    const existing = document.getElementById(MODAL_CSS_LINK_ID);
    if (existing) existing.remove();

    const style = document.createElement("link");
    style.id = MODAL_CSS_LINK_ID;
    style.rel = "stylesheet";
    style.href = cssLink;
    document.head.appendChild(style);
}

function extractDomain(origin: string): string {
    try {
        return new URL(origin).host.replace(/^www\./, "");
    } catch {
        return "";
    }
}

function isValidResolvedConfigPayload(data: unknown): data is {
    merchantId: string;
    domain: string;
    allowedDomains: string[];
    sourceUrl: string;
    pendingMergeToken?: string;
    sdkAnonymousId?: string;
    sdkIdentity?: unknown;
    sdkConfig?: ResolvedSdkConfig;
} {
    if (!data || typeof data !== "object") return false;
    const d = data as Record<string, unknown>;
    return (
        typeof d.merchantId === "string" &&
        typeof d.domain === "string" &&
        Array.isArray(d.allowedDomains) &&
        d.allowedDomains.every((v: unknown) => typeof v === "string") &&
        typeof d.sourceUrl === "string"
    );
}

/**
 * Safely pull a named proof off the untrusted `sdkIdentity` payload
 * (README §4.3/§4.4). `sdkIdentity` rides on `resolved-config` as `unknown`
 * on purpose — a malformed or partial value (old SDK, tampered message,
 * wrong type) must degrade to "no proof" rather than throw.
 */
function extractSdkProof(
    sdkIdentity: unknown,
    key: "merge" | "install"
): string | undefined {
    if (!sdkIdentity || typeof sdkIdentity !== "object") return undefined;
    const proofs = (sdkIdentity as Record<string, unknown>).proofs;
    if (!proofs || typeof proofs !== "object") return undefined;
    const proof = (proofs as Record<string, unknown>)[key];
    return typeof proof === "string" ? proof : undefined;
}

/**
 * The anonymous id `sdkIdentity`'s proofs are signed over. Read from
 * `sdkIdentity` itself, NOT from the sibling top-level `sdkAnonymousId`
 * field — they are separate keys on the same untrusted payload and a
 * tampered message can set them to different values.
 */
function extractSdkProvenId(sdkIdentity: unknown): string | undefined {
    if (!sdkIdentity || typeof sdkIdentity !== "object") return undefined;
    const id = (sdkIdentity as Record<string, unknown>).anonymousId;
    return typeof id === "string" ? id : undefined;
}

/**
 * Pick the merge target and the proof that covers it (README §4.3).
 *
 * The proof only verifies against the exact id it was signed over, so the
 * target must be that id. Where they cannot be reconciled the merge still
 * goes out, unproven — the backend accepts that while the id is unlatched,
 * and it is strictly better than sending a proof bound to a different id,
 * which would always fail verification and pollute the invalid-proof
 * telemetry ROLLOUT.md step 2 reads to decide when to enforce.
 */
function resolveMergeTarget(
    sdkIdentity: unknown,
    fallbackId: string | null | undefined
): { targetAnonymousId?: string; proof?: string } {
    const provenId = extractSdkProvenId(sdkIdentity);
    if (provenId) {
        return {
            targetAnonymousId: provenId,
            proof: extractSdkProof(sdkIdentity, "merge"),
        };
    }
    return { targetAnonymousId: fallbackId ?? undefined };
}

async function handleResolvedConfig(
    data: {
        merchantId: string;
        domain: string;
        allowedDomains: string[];
        sourceUrl: string;
        pendingMergeToken?: string;
        sdkAnonymousId?: string;
        sdkIdentity?: unknown;
        sdkConfig?: ResolvedSdkConfig;
    },
    context: RpcRequestContext
): Promise<void> {
    if (!isValidResolvedConfigPayload(data)) {
        console.warn("[Frak] Invalid resolved-config payload, ignoring");
        return;
    }

    let parsedOrigin: string;
    try {
        parsedOrigin = new URL(data.sourceUrl).origin;
    } catch {
        console.warn("[Frak] Invalid sourceUrl in resolved-config, ignoring");
        return;
    }

    const originDomain = extractDomain(context.origin);
    const store = resolvingContextStore.getState();

    const isOriginAllowed = data.allowedDomains
        .map((d) => d.replace(/^www\./, ""))
        .some((d) => d === originDomain);

    if (isOriginAllowed) {
        store.setTrustLevel("verified");
    } else if (data.merchantId) {
        store.setTrustLevel("dev-override");
        console.warn(
            `[Frak] Running on ${originDomain} with config for ${data.domain}. Register ${originDomain} in your dashboard for production use.`
        );
    } else {
        store.setTrustLevel("unverified");
        console.warn(
            `[Frak] Domain proof failed: origin ${originDomain} not in allowedDomains. Running in display-only mode (modals and wallet status will work, interactions are disabled).`,
            data.allowedDomains
        );
    }

    const installProof = extractSdkProof(data.sdkIdentity, "install");
    store.setContext({
        merchantId: data.merchantId,
        origin: parsedOrigin,
        sourceUrl: data.sourceUrl,
        ...(iframeClientId && { clientId: iframeClientId }),
        ...(installProof && { installProof }),
    });

    // Stitch SDK ↔ listener funnels: if the SDK propagated its persistent
    // anonymous id through the resolved-config payload, expose it as a
    // global OpenPanel property so every listener event is joinable with
    // the corresponding SDK events.
    if (data.sdkAnonymousId) {
        updateGlobalProperties({ sdk_anonymous_id: data.sdkAnonymousId });
    }

    store.setBackendConfig(data.merchantId, data.sdkConfig);

    // Identity merge — only allowed for verified trust (origin in allowedDomains)
    const currentTrust = resolvingContextStore.getState().trustLevel;
    if (
        data.pendingMergeToken &&
        data.merchantId &&
        currentTrust === "verified"
    ) {
        const { targetAnonymousId, proof: mergeProof } = resolveMergeTarget(
            data.sdkIdentity,
            iframeClientId ?? clientIdStore.getState().clientId
        );
        if (targetAnonymousId) {
            // `fmt` token is produced by the in-app-browser escape flow
            // (see `InAppBrowserToast`). Tagging the merge outcome with
            // source="inapp_redirect" lets us compute merge success rate
            // for users who bounced out of in-app browsers.
            const startedAt = Date.now();
            trackEvent("identity_ensure_executed", {
                source: "inapp_redirect",
            });
            authenticatedBackendApi.user.identity.merge.execute
                .post({
                    mergeToken: data.pendingMergeToken,
                    targetAnonymousId,
                    merchantId: data.merchantId,
                    proof: mergeProof,
                })
                .then(({ error }) => {
                    if (error) {
                        trackEvent("identity_ensure_failed", {
                            source: "inapp_redirect",
                            error_type:
                                (error as { value?: { code?: string } })?.value
                                    ?.code ?? "unknown",
                        });
                        return;
                    }
                    trackEvent("identity_ensure_succeeded", {
                        source: "inapp_redirect",
                        duration_ms: Date.now() - startedAt,
                    });
                })
                .catch((error) => {
                    trackEvent("identity_ensure_failed", {
                        source: "inapp_redirect",
                        error_type:
                            error instanceof Error ? error.name : "unknown",
                    });
                    console.warn("Unable to merge client identities", error);
                });
        }
    }

    if (!data.sdkConfig) return;

    applyBackendCss(data.sdkConfig);
    if (data.sdkConfig.lang) {
        // Queue — drained by Ring 1 once i18next is initialised.
        enqueueLanguageChange(data.sdkConfig.lang);
    }
}

function applyBackendCss(sdkConfig: ResolvedSdkConfig): void {
    if (!sdkConfig.css) return;

    const existing = document.getElementById(BACKEND_CSS_STYLE_ID);
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = BACKEND_CSS_STYLE_ID;
    style.textContent = sdkConfig.css;
    document.head.appendChild(style);
}

async function handleSsoRedirectComplete(data: {
    compressed: string;
}): Promise<void> {
    try {
        // Decompress the SSO data (SDK passed it through without decompression)
        const compressedParam = decompressJsonFromB64<[Session, SdkSession]>(
            data.compressed
        );

        if (!compressedParam) {
            console.error("[SSO Redirect] Failed to decompress SSO data");
            return;
        }

        // Parse the SSO result
        const [session, sdkSession] = compressedParam;
        await processSsoCompletion(session, sdkSession);
    } catch (error) {
        console.error("[SSO Redirect] Error processing SSO redirect:", error);
    }
}
