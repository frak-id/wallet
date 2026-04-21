import {
    createRpcClient,
    Deferred,
    FrakRpcError,
    type RpcClient,
    RpcErrorCodes,
} from "@frak-labs/frame-connector";
import { OpenPanel } from "@openpanel/web";
import type { FrakLifecycleEvent } from "../types";
import type { FrakClient } from "../types/client";
import type { FrakWalletSdkConfig } from "../types/config";
import type { SdkResolvedConfig } from "../types/resolvedConfig";
import type { IFrameRpcSchema } from "../types/rpc";
import { getClientId } from "../utils";
import { clearAllCache } from "../utils/cache";
import { BACKUP_KEY } from "../utils/constants";
import { sdkConfigStore } from "../utils/sdkConfigStore";
import { setupSsoUrlListener } from "../utils/ssoUrlListener";
import { DebugInfoGatherer } from "./DebugInfo";
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
export function createIFrameFrakClient({
    config,
    iframe,
}: {
    config: FrakWalletSdkConfig;
    iframe: HTMLIFrameElement;
}): FrakClient {
    const frakWalletUrl = config?.walletUrl ?? "https://wallet.frak.id";

    const browserLang =
        typeof navigator !== "undefined"
            ? navigator.language?.split("-")[0]
            : undefined;
    const detectedLang =
        config.metadata.lang ??
        (browserLang === "en" || browserLang === "fr"
            ? browserLang
            : undefined);
    const targetDomain =
        config.domain ??
        (typeof window !== "undefined" ? window.location.hostname : "");
    sdkConfigStore.setCacheScope(targetDomain, detectedLang);
    sdkConfigStore.reset();

    // Skip fetch entirely if cache is fresh, otherwise fetch (SWR)
    const configPromise = sdkConfigStore.isCacheFresh
        ? undefined
        : sdkConfigStore.resolve(config.domain, config.walletUrl, detectedLang);

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

    // Create our debug info gatherer
    const debugInfo = new DebugInfoGatherer(config, iframe);

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
            // Save debug info
            {
                onRequest(message, ctx) {
                    debugInfo.setLastRequest(message);
                    return ctx;
                },
                onResponse(message, response) {
                    debugInfo.setLastResponse(message, response);
                    return response;
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

    const destroy = async () => {
        stopHeartbeat();
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
                if (!("sdkVersion" in payload.properties)) {
                    payload.properties = {
                        ...payload.properties,
                        sdkVersion: process.env.SDK_VERSION,
                        userAnonymousClientId: getClientId(),
                    };
                }

                return true;
            },
        });
        openPanel.setGlobalProperties({
            sdkVersion: process.env.SDK_VERSION,
            userAnonymousClientId: getClientId(),
        });
        openPanel.init();
        openPanel.track("sdk_initialized", {
            sdkVersion: process.env.SDK_VERSION,
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
            openPanel?.track("sdk_iframe_heartbeat_timeout", undefined);
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
    })
        .then(() => debugInfo.updateSetupStatus(true))
        .catch((err) => {
            contextSent.reject(err);
            throw err;
        });

    return {
        config,
        debugInfo,
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
    const HEARTBEAT_INTERVAL = 1_000; // Send heartbeat every 100ms until we are connected
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

/**
 * Perform the post connection setup
 * @param config - SDK configuration
 * @param rpcClient - RPC client to send lifecycle events
 * @param lifecycleManager - Lifecycle manager to track connection
 */
async function postConnectionSetup({
    config,
    rpcClient,
    lifecycleManager,
    configPromise,
    contextSent,
    openPanel,
}: {
    config: FrakWalletSdkConfig;
    rpcClient: SdkRpcClient;
    lifecycleManager: IframeLifecycleManager;
    configPromise: Promise<MerchantConfigResult> | undefined;
    contextSent: Deferred<void>;
    openPanel: OpenPanel | undefined;
}): Promise<void> {
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
    const sendLifecycleConfig = (resolved: SdkResolvedConfig) => {
        const token = mergeTokenConsumed ? undefined : pendingMergeToken;
        mergeTokenConsumed = true;

        const sdkConfig = resolved.hasRawSdkConfig
            ? {
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
              }
            : resolved.attribution
              ? { attribution: resolved.attribution }
              : undefined;

        const sdkAnonymousId = getClientId();

        if (openPanel) {
            const current = openPanel.global ?? {};
            openPanel.setGlobalProperties({
                ...current,
                merchantId: resolved.merchantId,
                domain: resolved.domain ?? "",
            });
        }

        rpcClient.sendLifecycle({
            clientLifecycle: "resolved-config",
            data: {
                merchantId: resolved.merchantId,
                domain: resolved.domain ?? "",
                allowedDomains: resolved.allowedDomains ?? [],
                sourceUrl: window.location.href,
                ...(sdkAnonymousId && { sdkAnonymousId }),
                ...(token && { pendingMergeToken: token }),
                ...(sdkConfig && { sdkConfig }),
            },
        });
    };

    // SWR: if we have cached data, send it to the iframe immediately
    if (sdkConfigStore.isResolved) {
        sendLifecycleConfig(sdkConfigStore.getConfig());
        contextSent.resolve();
    }

    // If a fetch is running (stale/missing cache), wait for fresh data and update
    if (configPromise) {
        const merchantConfig = await configPromise;
        mergeAndSetConfig(merchantConfig);
        sendLifecycleConfig(sdkConfigStore.getConfig());
        contextSent.resolve();
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

    await Promise.allSettled([pushCss(), pushI18n(), pushBackup()]);
}
