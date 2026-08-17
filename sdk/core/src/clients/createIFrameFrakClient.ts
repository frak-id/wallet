import {
    createRpcClient,
    Deferred,
    FrakRpcError,
    type RpcClient,
    RpcErrorCodes,
} from "@frak-labs/frame-connector";
import { sha256 } from "@noble/hashes/sha2.js";
import { OpenPanel } from "@openpanel/web";
import { getClientIdAsync } from "../config/clientId";
import { setEnvironment } from "../config/environment";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { BACKUP_KEY } from "../constants";
import { signProof } from "../identity/sign";
import type { FrakLifecycleEvent } from "../types";
import type { FrakClient } from "../types/client";
import type { FrakWalletSdkConfig } from "../types/config";
import type { SdkResolvedConfig } from "../types/resolvedConfig";
import type { IFrameRpcSchema } from "../types/rpc";
import { clearAllCache } from "../utils/cache";
import { detectPageLanguage } from "../utils/i18n/detectPageLanguage";
import { setupSsoUrlListener } from "./ssoUrlListener";
import {
    createIFrameLifecycleManager,
    type IframeLifecycleManager,
} from "./transports/iframeLifecycleManager";

type SdkRpcClient = RpcClient<IFrameRpcSchema, FrakLifecycleEvent>;
type MerchantConfigResult = Awaited<ReturnType<typeof sdkConfigStore.resolve>>;

/**
 * Create a new iframe Frak client
 * @param args
 * @param args.config - The configuration to use for the Frak Wallet SDK.
 *   When `config.domain` is set, it is used to resolve the correct merchant config in tunneled/proxied environments (e.g. Shopify dev with Cloudflare tunnel).
 * @param args.iframe - The iframe to use for the communication
 * @returns The created Frak Client
 *
 * @example
 * const frakConfig: FrakWalletSdkConfig = {
 *     metadata: {
 *         name: "My app title",
 *     },
 * }
 * const iframe = await createIframe({ config: frakConfig });
 * const client = createIFrameFrakClient({ config: frakConfig, iframe });
 */
export async function createIFrameFrakClient({
    config,
    iframe,
}: {
    config: FrakWalletSdkConfig;
    iframe: HTMLIFrameElement;
}): Promise<FrakClient> {
    // Idempotent with `createIframe`'s own call: the client is also created
    // directly (React provider, tests) with an iframe it didn't build.
    const frakWalletUrl = setEnvironment(config?.env).wallet;

    // Precedence: explicit `metadata.lang` → page `<html lang>` → browser
    // language. Lets a page authored in a given language drive SDK copy even
    // when the visitor's browser is set to another language.
    const detectedLang = config.metadata.lang ?? detectPageLanguage();
    const targetDomain =
        config.domain ??
        (typeof window !== "undefined" ? window.location.hostname : "");
    sdkConfigStore.setCacheScope(targetDomain, detectedLang);
    sdkConfigStore.reset();

    // Skip fetch entirely if cache is fresh, otherwise fetch (SWR)
    const configPromise = sdkConfigStore.isCacheFresh
        ? undefined
        : sdkConfigStore.resolve(config.domain, detectedLang);

    // Resolved once, here, rather than inside OpenPanel's `filter` callback
    // below (a sync predicate that can't await). Awaited after `configPromise`
    // is kicked off, so derivation overlaps the merchant-config fetch instead
    // of delaying it. Analytics must never block client creation, hence the catch.
    const resolvedClientId = await getClientIdAsync().catch(() => undefined);

    // Create lifecycle manager
    const lifecycleManager = createIFrameLifecycleManager({
        iframe,
        targetOrigin: frakWalletUrl,
    });

    // Resolved after first resolved-config is sent to iframe (prevents RPC before context exists)
    const contextSent = new Deferred<void>();

    // Handshake timing: measured from client creation until the iframe
    // lifecycle manager resolves the `isConnected` promise.
    const handshakeStartedAt = Date.now();

    // Validate iframe
    if (!iframe.contentWindow) {
        throw new FrakRpcError(
            RpcErrorCodes.configError,
            "The iframe does not have a content window"
        );
    }

    // Create RPC client with middleware and lifecycle handlers
    const rpcClient = createRpcClient<IFrameRpcSchema, FrakLifecycleEvent>({
        emittingTransport: iframe.contentWindow,
        listeningTransport: window,
        targetOrigin: frakWalletUrl,
        middleware: [
            // Ensure we are connected and context is sent before sending request
            {
                async onRequest(_message, ctx) {
                    const isConnected = await lifecycleManager.isConnected;
                    if (!isConnected) {
                        throw new FrakRpcError(
                            RpcErrorCodes.clientNotConnected,
                            "The iframe provider isn't connected yet"
                        );
                    }
                    await contextSent.promise;
                    return ctx;
                },
            },
        ],
        // Add lifecycle handlers to process iframe lifecycle events
        lifecycleHandlers: {
            iframeLifecycle: (event, _context) => {
                // Delegate to lifecycle manager  (cast for type compatibility)
                lifecycleManager.handleEvent(event);
            },
        },
    });

    // Setup heartbeat
    const stopHeartbeat = setupHeartbeat(rpcClient, lifecycleManager);

    // Assigned by `postConnectionSetup`, which runs after `destroy` is built.
    let stopFreshnessRepush: (() => void) | undefined;
    // `destroy` can win the race against setup, and the teardown it needs does
    // not exist yet at that point.
    let destroyed = false;

    const destroy = async () => {
        destroyed = true;
        stopHeartbeat();
        stopFreshnessRepush?.();
        rpcClient.cleanup();
        iframe.remove();
        clearAllCache();
        sdkConfigStore.clearCache();
        sdkConfigStore.reset();
    };

    // Init open panel
    let openPanel: OpenPanel | undefined;
    if (
        process.env.OPEN_PANEL_API_URL &&
        process.env.OPEN_PANEL_SDK_CLIENT_ID
    ) {
        console.log("[Frak SDK] Initializing OpenPanel");
        openPanel = new OpenPanel({
            apiUrl: process.env.OPEN_PANEL_API_URL,
            clientId: process.env.OPEN_PANEL_SDK_CLIENT_ID,
            trackScreenViews: true,
            trackOutgoingLinks: true,
            trackAttributes: false,
            // We use a filter to ensure we got the open panel instance initialized
            //  A bit hacky, but this way we are sure that we got everything needed for the first event ever sent
            filter: ({ type, payload }) => {
                if (type !== "track") return true;
                if (!payload?.properties) return true;

                // Check if we we got the properties once initialized
                if (!("sdk_version" in payload.properties)) {
                    payload.properties = {
                        ...payload.properties,
                        sdk_version: process.env.SDK_VERSION,
                        ...(resolvedClientId && {
                            user_anonymous_client_id: resolvedClientId,
                        }),
                    };
                }

                return true;
            },
        });
        openPanel.setGlobalProperties({
            sdk_version: process.env.SDK_VERSION,
            ...(resolvedClientId && {
                user_anonymous_client_id: resolvedClientId,
            }),
        });
        openPanel.init();
        openPanel.track("sdk_initialized", {
            sdk_version: process.env.SDK_VERSION,
        });

        // Race the connection against the heartbeat timeout so we can
        // distinguish "connected" from "timeout" cleanly without touching
        // the heartbeat plumbing. 30s matches `HEARTBEAT_TIMEOUT`.
        let settled = false;
        const timeoutHandle = setTimeout(() => {
            if (settled) return;
            settled = true;
            openPanel?.track("sdk_iframe_handshake_failed", {
                reason: "timeout",
            });
        }, 30_000);
        lifecycleManager.isConnected
            .then(() => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutHandle);
                openPanel?.track("sdk_iframe_connected", {
                    handshake_duration_ms: Date.now() - handshakeStartedAt,
                });
            })
            .catch(() => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutHandle);
                openPanel?.track("sdk_iframe_handshake_failed", {
                    reason: "unknown",
                });
            });
    }

    // Perform the post connection setup
    const waitForSetup = postConnectionSetup({
        config,
        rpcClient,
        lifecycleManager,
        configPromise,
        contextSent,
        openPanel,
        clientId: resolvedClientId,
    })
        .then((stopRepush) => {
            if (destroyed) {
                stopRepush();
                return;
            }
            stopFreshnessRepush = stopRepush;
        })
        .catch((err) => {
            contextSent.reject(err);
            throw err;
        });

    return {
        config,
        waitForConnection: lifecycleManager.isConnected,
        waitForSetup,
        request: rpcClient.request,
        listenerRequest: rpcClient.listen,
        destroy,
        openPanel,
    };
}

/**
 * Setup the heartbeat
 * @param rpcClient - RPC client to send lifecycle events
 * @param lifecycleManager - Lifecycle manager to track connection
 */
function setupHeartbeat(
    rpcClient: SdkRpcClient,
    lifecycleManager: IframeLifecycleManager
) {
    const HEARTBEAT_INTERVAL = 250; // Fallback discovery ping until we are connected
    const HEARTBEAT_TIMEOUT = 30_000; // 30 seconds timeout
    let heartbeatInterval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const sendHeartbeat = () =>
        rpcClient.sendLifecycle({
            clientLifecycle: "heartbeat",
        });

    // Start sending heartbeats
    async function startHeartbeat() {
        sendHeartbeat(); // Send initial heartbeat
        heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

        // Set up timeout
        timeoutId = setTimeout(() => {
            stopHeartbeat();
            console.log("Heartbeat timeout: connection failed");
        }, HEARTBEAT_TIMEOUT);

        // Once connected, stop it
        await lifecycleManager.isConnected;

        // We are now connected, stop the heartbeat
        stopHeartbeat();
    }

    // Stop sending heartbeats
    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }

    startHeartbeat();

    // Return cleanup function
    return stopHeartbeat;
}

/** Extracted from `sendLifecycleConfig` to keep its cognitive complexity in budget. */
function buildResolvedSdkConfig(resolved: SdkResolvedConfig) {
    if (resolved.hasRawSdkConfig) {
        return {
            name: resolved.name,
            logoUrl: resolved.logoUrl,
            homepageLink: resolved.homepageLink,
            lang: resolved.lang,
            currency: resolved.currency,
            hidden: resolved.hidden,
            css: resolved.css,
            translations: resolved.translations,
            placements: resolved.placements,
            attribution: resolved.attribution,
        };
    }
    return resolved.attribution
        ? { attribution: resolved.attribution }
        : undefined;
}

/** Extracted from `sendLifecycleConfig` to keep its cognitive complexity in budget. */
function updateOpenPanelMerchantProps(
    openPanel: OpenPanel | undefined,
    resolved: SdkResolvedConfig
): void {
    if (!openPanel) return;
    const current = openPanel.global ?? {};
    openPanel.setGlobalProperties({
        ...current,
        merchant_id: resolved.merchantId,
        domain: resolved.domain ?? "",
    });
}

async function hashMergeToken(token: string): Promise<Uint8Array | undefined> {
    const encoded = new TextEncoder().encode(token);
    if (typeof crypto !== "undefined" && crypto.subtle) {
        try {
            const digest = await crypto.subtle.digest(
                "SHA-256",
                encoded as BufferSource
            );
            return new Uint8Array(digest);
        } catch {}
    }
    // WebCrypto is absent on non-secure-context merchant pages, where
    // `signProof` still signs via pure JS — so the binding must not be the
    // thing that drops the merge proof.
    try {
        return sha256(encoded);
    } catch {
        return undefined;
    }
}

/**
 * Produce the named, domain-separated proofs carried on `resolved-config`.
 * Never throws and never blocks the handshake: `signProof` resolves to
 * `null` (never rejects) when no key is available.
 *
 * The execute-side proof is emitted under both `merge` and `mergeExecute`:
 * the SDK and the listener deploy on pipelines that fire concurrently, so
 * either key may be the one a live listener reads.
 *
 * ROLLOUT-STEP-1: `proofs.install` travels on `resolved-config` and the
 * listener forwards it into the `/install` URL as a `#p=` fragment — the
 * wallet's install route still needs to read it and send it to the backend.
 */
async function buildSdkIdentity({
    merchantId,
    anonymousId,
    pendingMergeToken,
}: {
    merchantId: string;
    anonymousId: string;
    pendingMergeToken?: string;
}): Promise<
    | {
          anonymousId: string;
          proofs: {
              merge?: string;
              mergeExecute?: string;
              mergeSource?: string;
              install?: string;
          };
      }
    | undefined
> {
    // No binding could be produced (e.g. no WebCrypto on an HTTP merchant
    // page) but a token is pending — omit the execute proof rather than sign
    // over the wrong binding.
    const mergeBinding = pendingMergeToken
        ? await hashMergeToken(pendingMergeToken)
        : undefined;

    const [mergeExecute, mergeSource, install] = await Promise.all([
        mergeBinding
            ? signProof({
                  op: "frak-merge-v1",
                  merchantId,
                  anonymousId,
                  binding: mergeBinding,
              })
            : Promise.resolve(null),
        // Empty binding, so it is signable before any token exists — which is
        // the point: `/merge/initiate` is what mints the token.
        signProof({ op: "frak-merge-v1", merchantId, anonymousId }),
        signProof({ op: "frak-install-v1", merchantId, anonymousId }),
    ]);

    if (!mergeExecute && !mergeSource && !install) return undefined;

    return {
        anonymousId,
        proofs: {
            ...(mergeExecute && { merge: mergeExecute, mergeExecute }),
            ...(mergeSource && { mergeSource }),
            ...(install && { install }),
        },
    };
}

/**
 * Perform the post connection setup.
 * @param config - SDK configuration
 * @param rpcClient - RPC client to send lifecycle events
 * @param lifecycleManager - Lifecycle manager to track connection
 * @returns a teardown for the freshness listener it installs
 */
async function postConnectionSetup({
    config,
    rpcClient,
    lifecycleManager,
    configPromise,
    contextSent,
    openPanel,
    clientId,
}: {
    config: FrakWalletSdkConfig;
    rpcClient: SdkRpcClient;
    lifecycleManager: IframeLifecycleManager;
    configPromise: Promise<MerchantConfigResult> | undefined;
    contextSent: Deferred<void>;
    openPanel: OpenPanel | undefined;
    /** Resolved once by the caller — see `createIFrameFrakClient`. */
    clientId: string | undefined;
}): Promise<() => void> {
    await lifecycleManager.isConnected;

    setupSsoUrlListener(rpcClient, lifecycleManager.isConnected);

    // Read and consume the pending merge token from URL (SSO identity merge)
    const url = new URL(window.location.href);
    const pendingMergeToken = url.searchParams.get("fmt") ?? undefined;
    if (pendingMergeToken) {
        url.searchParams.delete("fmt");
        window.history.replaceState({}, "", url.toString());
    }

    // Merge a raw backend response with SDK metadata and persist to store
    const mergeAndSetConfig = (merchantConfig: MerchantConfigResult) => {
        const merchantId =
            merchantConfig?.merchantId ?? config.metadata.merchantId ?? "";
        const domain = merchantConfig?.domain ?? "";
        const allowedDomains = merchantConfig?.allowedDomains ?? [];
        const raw = merchantConfig?.sdkConfig;

        // Per-field merge: backend wins over SDK static config.
        const mergedAttribution =
            raw?.attribution || config.attribution
                ? { ...config.attribution, ...raw?.attribution }
                : undefined;

        sdkConfigStore.setConfig(
            raw
                ? {
                      isResolved: true,
                      merchantId,
                      domain,
                      allowedDomains,
                      hasRawSdkConfig: true,
                      name: raw.name ?? config.metadata.name,
                      logoUrl: raw.logoUrl ?? config.metadata.logoUrl,
                      homepageLink:
                          raw.homepageLink ?? config.metadata.homepageLink,
                      lang: raw.lang ?? config.metadata.lang,
                      currency: raw.currency ?? config.metadata.currency,
                      hidden: raw.hidden,
                      css: raw.css,
                      translations: raw.translations,
                      placements: raw.placements,
                      components: raw.components,
                      attribution: mergedAttribution,
                  }
                : {
                      isResolved: true,
                      merchantId,
                      domain,
                      allowedDomains,
                      name: config.metadata.name,
                      logoUrl: config.metadata.logoUrl,
                      homepageLink: config.metadata.homepageLink,
                      lang: config.metadata.lang,
                      currency: config.metadata.currency,
                      attribution: mergedAttribution,
                  }
        );
    };

    // Send the resolved-config lifecycle event to the iframe.
    // This is where we also update SDK-side OpenPanel global props with
    // `merchantId` + `domain` (first time they are known) so every
    // subsequent SDK event is merchant-attributed. We pass
    // `sdkAnonymousId` through so the listener can join SDK funnels.
    let mergeTokenConsumed = false;
    // Sends are chained onto this so postMessage order always matches call
    // order: `buildSdkIdentity`'s signing duration varies, so the two
    // fire-and-forget sends (cached, then fresh) could otherwise race and
    // land out of order, and the listener's last-write-wins would let a
    // reordered cached send silently revert the fresh one.
    let sendChain: Promise<void> = Promise.resolve();
    const sendLifecycleConfig = (resolved: SdkResolvedConfig) => {
        // Token capture stays synchronous at call time so the first call
        // still consumes it, regardless of how long a previous send's
        // signing takes.
        const token = mergeTokenConsumed ? undefined : pendingMergeToken;
        mergeTokenConsumed = true;

        const sdkConfig = buildResolvedSdkConfig(resolved);
        // Reuses the id resolved once at client construction rather than
        // re-reading the sync accessor: this runs inside a sync callback, so
        // a cold read here could only ever yield `undefined`.
        const sdkAnonymousId = clientId;
        const sourceUrl = window.location.href;

        updateOpenPanelMerchantProps(openPanel, resolved);

        sendChain = sendChain
            .then(async () => {
                rpcClient.sendLifecycle({
                    clientLifecycle: "resolved-config",
                    data: {
                        merchantId: resolved.merchantId,
                        domain: resolved.domain ?? "",
                        allowedDomains: resolved.allowedDomains ?? [],
                        sourceUrl,
                        ...(sdkAnonymousId && { sdkAnonymousId }),
                        ...(token && { pendingMergeToken: token }),
                        ...(sdkConfig && { sdkConfig }),
                        ...(sdkAnonymousId && {
                            sdkIdentity: await buildSdkIdentity({
                                merchantId: resolved.merchantId,
                                anonymousId: sdkAnonymousId,
                                pendingMergeToken: token,
                            }),
                        }),
                    },
                });
            })
            .catch((error) => {
                // Swallow here (not just re-throw) so a failed send doesn't
                // permanently stall the chain for later, unrelated sends.
                console.error("Failed to send lifecycle config", error);
            });
        return sendChain;
    };

    // SWR: if we have cached data, send it to the iframe immediately.
    // Not awaited — signing must stay off the connection-establishment
    // critical path. `contextSent` resolves from the send's completion, NOT
    // synchronously after firing it: resolving early would release RPC
    // requests that then beat `resolved-config` to the listener, which
    // rejects them with "No resolving context available".
    if (sdkConfigStore.isResolved) {
        void sendLifecycleConfig(sdkConfigStore.getConfig()).then(
            contextSent.resolve
        );
    }

    // If a fetch is running (stale/missing cache), wait for fresh data and update
    if (configPromise) {
        const merchantConfig = await configPromise;
        mergeAndSetConfig(merchantConfig);
        void sendLifecycleConfig(sdkConfigStore.getConfig()).then(
            contextSent.resolve
        );
    }

    // Push raw CSS if needed
    async function pushCss() {
        const cssLink = config.customizations?.css;
        if (!cssLink) return;
        rpcClient.sendLifecycle({
            clientLifecycle: "modal-css" as const,
            data: { cssLink },
        });
    }

    // Push i18n if needed
    async function pushI18n() {
        const i18n = config.customizations?.i18n;
        if (!i18n) return;
        rpcClient.sendLifecycle({
            clientLifecycle: "modal-i18n" as const,
            data: { i18n },
        });
    }

    // Push local backup if needed
    async function pushBackup() {
        if (typeof window === "undefined") return;
        const backup = window.localStorage.getItem(BACKUP_KEY);
        if (!backup) return;
        rpcClient.sendLifecycle({
            clientLifecycle: "restore-backup" as const,
            data: { backup },
        });
    }

    // Inspect each setup result — a failed CSS/i18n/backup push leaves the
    // partner UI in a broken-but-connected state (iframe reports
    // `sdk_iframe_connected`, user sees no modal styles / wrong locale).
    // Surface it as a distinct handshake reason so dashboards can
    // distinguish timeout vs. asset-push failures.
    const results = await Promise.allSettled([
        pushCss(),
        pushI18n(),
        pushBackup(),
    ]);
    const hasFailedAssetPush = results.some((r) => r.status === "rejected");
    if (hasFailedAssetPush) {
        openPanel?.track("sdk_iframe_handshake_failed", {
            reason: "asset_push",
        });
    }

    return setupProofFreshnessRepush(sendLifecycleConfig);
}

/** Half of `frak-merge-v1`'s 600 s window, so a stored proof is never stale. */
const PROOF_REPUSH_INTERVAL_MS = 5 * 60 * 1000;

/** Focus churn (app switching, tab flicking, bfcache) must not sign per event. */
const PROOF_REPUSH_MIN_INTERVAL_MS = 60 * 1000;

/**
 * Keep `proofs.mergeSource` fresh. The listener's modal and embed arms read
 * the stored proof after arbitrary dwell, so a tab that never hides would
 * otherwise present one past its window. The listener is last-write-wins.
 */
function setupProofFreshnessRepush(
    sendLifecycleConfig: (resolved: SdkResolvedConfig) => Promise<void>
): () => void {
    if (typeof document === "undefined") return () => {};

    let lastRepushAt = 0;

    const repush = (throttled: boolean) => {
        if (document.visibilityState !== "visible") return;
        if (!sdkConfigStore.isResolved) return;
        const now = Date.now();
        if (throttled && now - lastRepushAt < PROOF_REPUSH_MIN_INTERVAL_MS) {
            return;
        }
        lastRepushAt = now;
        void sendLifecycleConfig(sdkConfigStore.getConfig());
    };

    const onVisibilityChange = () => repush(true);
    const timer = setInterval(() => repush(false), PROOF_REPUSH_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisibilityChange);
    };
}
