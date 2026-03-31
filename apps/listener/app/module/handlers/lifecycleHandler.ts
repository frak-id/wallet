import type { FrakLifecycleEvent } from "@frak-labs/core-sdk";
import { decompressJsonFromB64 } from "@frak-labs/core-sdk";
import type {
    LifecycleHandler,
    RpcRequestContext,
} from "@frak-labs/frame-connector";
import type { SdkSession, Session } from "@frak-labs/wallet-shared";
import {
    authenticatedBackendApi,
    clientIdStore,
    emitLifecycleEvent,
    mapI18nConfig,
    restoreBackupData,
} from "@frak-labs/wallet-shared";
import { getI18n } from "react-i18next";
import {
    iframeClientId,
    resolvingContextStore,
} from "@/module/stores/resolvingContextStore";
import type { ResolvedSdkConfig } from "@/module/stores/types";
import { sanitizeCss } from "@/module/utils/sanitizeCss";
import { processSsoCompletion } from "./ssoHandler";

/**
 * Create a client lifecycle handler for the RPC listener
 *
 * @param setReadyToHandleRequest - Callback to signal wallet is ready
 * @returns Lifecycle handler function
 */
export const createClientLifecycleHandler =
    (
        setReadyToHandleRequest: () => void
    ): LifecycleHandler<FrakLifecycleEvent> =>
    async (messageEvent, context) => {
        if (!("clientLifecycle" in messageEvent)) return;
        const { clientLifecycle: event, data } = messageEvent;

        switch (event) {
            case "modal-css": {
                const style = document.createElement("link");
                style.rel = "stylesheet";
                style.href = data.cssLink;
                document.head.appendChild(style);
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
                // Get the current i18n instance
                const i18n = getI18n();
                // Type assertion is safe here because we validate it's an object above
                await mapI18nConfig(override, i18n);
                return;
            }

            case "restore-backup": {
                await handleRestoreBackup(data.backup, context);
                return;
            }

            case "heartbeat": {
                // Tell that we are rdy to handle request
                setReadyToHandleRequest();
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

function extractDomain(origin: string): string {
    try {
        return new URL(origin).host.replace(/^www\./, "");
    } catch {
        return "";
    }
}

async function handleResolvedConfig(
    data: {
        merchantId: string;
        domain: string;
        allowedDomains: string[];
        sourceUrl: string;
        pendingMergeToken?: string;
        sdkConfig?: ResolvedSdkConfig;
    },
    context: RpcRequestContext
): Promise<void> {
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

    // Set the resolving context from this event
    const origin = new URL(data.sourceUrl).origin;
    store.setContext({
        merchantId: data.merchantId,
        origin,
        sourceUrl: data.sourceUrl,
        ...(iframeClientId && { clientId: iframeClientId }),
    });

    store.setBackendConfig(data.merchantId, data.sdkConfig);

    // Identity merge (previously in setBackendConfig — moved here for clarity)
    if (data.pendingMergeToken && data.merchantId) {
        const targetAnonymousId =
            iframeClientId ?? clientIdStore.getState().clientId;
        if (targetAnonymousId) {
            authenticatedBackendApi.user.identity.merge.execute
                .post({
                    mergeToken: data.pendingMergeToken,
                    targetAnonymousId,
                    merchantId: data.merchantId,
                })
                .catch((error) => {
                    console.warn("Unable to merge client identities", error);
                });
        }
    }

    if (!data.sdkConfig) return;

    applyBackendCss(data.sdkConfig);
    await applyBackendLang(data.sdkConfig);
}

function applyBackendCss(sdkConfig: ResolvedSdkConfig): void {
    if (!sdkConfig.css) return;

    const existing = document.getElementById(BACKEND_CSS_STYLE_ID);
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = BACKEND_CSS_STYLE_ID;
    style.textContent = sanitizeCss(sdkConfig.css);
    document.head.appendChild(style);
}

async function applyBackendLang(sdkConfig: ResolvedSdkConfig): Promise<void> {
    const i18n = getI18n();
    if (sdkConfig.lang && sdkConfig.lang !== i18n.language) {
        await i18n.changeLanguage(sdkConfig.lang);
    }
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
