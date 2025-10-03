import { FrakRpcError, RpcErrorCodes, createRpcClient } from "@frak-labs/rpc";
import { createClientCompressionMiddleware } from "@frak-labs/rpc/middleware";
import { OpenPanel } from "@openpanel/web";
import type { FrakClient } from "../types/client";
import type { FrakWalletSdkConfig } from "../types/config";
import type { IFrameLifecycleEvent } from "../types/lifecycle";
import type { IFrameRpcSchema } from "../types/rpc";
import { BACKUP_KEY } from "../utils/constants";
import { setupSsoUrlListener } from "../utils/ssoUrlListener";
import { DebugInfoGatherer } from "./DebugInfo";
import {
    type IframeLifecycleManager,
    createIFrameLifecycleManager,
} from "./transports/iframeLifecycleManager";

/**
 * Create a new iframe Frak client
 * @param args
 * @param args.config - The configuration to use for the Frak Wallet SDK
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

    // Create lifecycle manager
    const lifecycleManager = createIFrameLifecycleManager({ iframe });

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
    const rpcClient = createRpcClient<IFrameRpcSchema>({
        emittingTransport: iframe.contentWindow,
        listeningTransport: window,
        targetOrigin: frakWalletUrl,
        // Add compression middleware to handle request/response compression
        middleware: [
            // Ensure we are connected before sending request
            {
                async onRequest(_message, ctx) {
                    // Ensure the iframe is connected
                    const isConnected = await lifecycleManager.isConnected;
                    if (!isConnected) {
                        throw new FrakRpcError(
                            RpcErrorCodes.clientNotConnected,
                            "The iframe provider isn't connected yet"
                        );
                    }
                    return ctx;
                },
            },
            createClientCompressionMiddleware(),
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
            iframeLifecycle: async (event, data) => {
                // Build the lifecycle event object
                const lifecycleEvent = {
                    iframeLifecycle: event,
                    data: data,
                };

                // Delegate to lifecycle manager  (cast for type compatibility)
                await lifecycleManager.handleEvent(
                    lifecycleEvent as IFrameLifecycleEvent
                );
            },
        },
    });

    // Setup heartbeat
    const stopHeartbeat = setupHeartbeat(rpcClient, lifecycleManager);

    // Build our destroy function
    const destroy = async () => {
        // Stop heartbeat
        stopHeartbeat();
        // Cleanup the RPC client
        rpcClient.cleanup();
        // Remove the iframe
        iframe.remove();
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
                    };
                }

                return true;
            },
        });
        openPanel.setGlobalProperties({
            sdkVersion: process.env.SDK_VERSION,
        });
        openPanel.init();
    }

    // Perform the post connection setup
    const waitForSetup = postConnectionSetup({
        config,
        rpcClient,
        lifecycleManager,
    }).then(() => debugInfo.updateSetupStatus(true));

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
    rpcClient: ReturnType<typeof createRpcClient<IFrameRpcSchema>>,
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
}: {
    config: FrakWalletSdkConfig;
    rpcClient: ReturnType<typeof createRpcClient<IFrameRpcSchema>>;
    lifecycleManager: IframeLifecycleManager;
}): Promise<void> {
    // Wait for the handler to be connected
    await lifecycleManager.isConnected;

    // Setup SSO URL listener to detect and forward SSO redirects
    // This checks for ?sso= parameter and forwards compressed data to iframe
    setupSsoUrlListener(rpcClient, lifecycleManager.isConnected);

    // Push raw CSS if needed
    async function pushCss() {
        const cssLink = config.customizations?.css;
        if (!cssLink) return;

        const message = {
            clientLifecycle: "modal-css" as const,
            data: { cssLink },
        };
        rpcClient.sendLifecycle(message);
    }

    // Push i18n if needed
    async function pushI18n() {
        const i18n = config.customizations?.i18n;
        if (!i18n) return;

        const message = {
            clientLifecycle: "modal-i18n" as const,
            data: { i18n },
        };
        rpcClient.sendLifecycle(message);
    }

    // Push local backup if needed
    async function pushBackup() {
        if (typeof window === "undefined") return;

        const backup = window.localStorage.getItem(BACKUP_KEY);
        if (!backup) return;

        const message = {
            clientLifecycle: "restore-backup" as const,
            data: { backup },
        };
        rpcClient.sendLifecycle(message);
    }

    await Promise.allSettled([pushCss(), pushI18n(), pushBackup()]);
}
