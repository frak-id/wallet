import { createRpcClient } from "@frak-labs/rpc";
import { OpenPanel } from "@openpanel/web";
import { type ExtractedParametersFromRpc, FrakRpcError } from "../types";
import type { FrakClient } from "../types/client";
import type { FrakWalletSdkConfig } from "../types/config";
import type { IFrameRpcSchema } from "../types/rpc";
import { RpcErrorCodes } from "../types/rpc/error";
import type { ListenerRequestFn, RequestFn } from "../types/transport";
import { BACKUP_KEY } from "../utils/constants";
import { DebugInfoGatherer } from "./DebugInfo";
import { createCompressionTransport } from "./transports/compressionTransport";
import {
    type IframeLifecycleManager,
    createIFrameLifecycleManager,
} from "./transports/iframeLifecycleManager";
import {
    type LifecycleMessageHandler,
    createLifecycleMessageHandler,
} from "./transports/lifecycleMessageHandler";

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

    // Create lifecycle message handler (for non-RPC messages)
    const lifecycleHandler = createLifecycleMessageHandler({
        frakWalletUrl,
        iframe,
        lifecycleManager,
        debugInfo,
    });

    // Validate iframe
    if (!iframe.contentWindow) {
        throw new FrakRpcError(
            RpcErrorCodes.configError,
            "The iframe does not have a content window"
        );
    }

    // Create compression transport wrapper
    const compressionTransport = createCompressionTransport({
        transport: iframe.contentWindow,
        targetOrigin: frakWalletUrl,
    });

    // Create RPC client with schema type
    const rpcClient = createRpcClient<IFrameRpcSchema>({
        transport: compressionTransport,
        targetOrigin: frakWalletUrl,
    });

    // Connect the RPC client (no handshake for now, maintains backward compatibility)
    rpcClient.connect();

    // Build our request function that wraps the RPC client
    const request: RequestFn<IFrameRpcSchema> = async <_, TResult>(
        args: ExtractedParametersFromRpc<IFrameRpcSchema>
    ) => {
        // Ensure the iframe is connected
        const isConnected = await lifecycleManager.isConnected;
        if (!isConnected) {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        }

        // Use the RPC client to make the request
        // The RPC client expects (method, ...params) where params is variadic
        // args.params is already a tuple or undefined, so we can spread it
        // @ts-expect-error - Type gymnastics between tuple spreading and variadic args
        return rpcClient.request(args.method, args.params) as Promise<TResult>;
    };

    // Build our listener function that wraps the RPC client stream
    const listenerRequest: ListenerRequestFn<IFrameRpcSchema> = async <
        _,
        TResult,
    >(
        args: ExtractedParametersFromRpc<IFrameRpcSchema>,
        callback: (result: TResult) => void
    ) => {
        // Ensure the iframe is connected
        const isConnected = await lifecycleManager.isConnected;
        if (!isConnected) {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        }

        // Use the RPC client stream and convert to callback pattern
        // args.params is already a tuple or undefined
        // @ts-expect-error - Type gymnastics between tuple spreading and variadic args
        const stream = rpcClient.stream(args.method, args.params);

        // Consume the stream and call the callback for each result
        // Run this in the background, don't await
        (async () => {
            try {
                for await (const result of stream) {
                    callback(result as TResult);
                }
            } catch (error) {
                console.error("[Frak Client] Stream error:", error);
                // Stream errors are logged but not propagated since this runs in background
            }
        })();
    };

    // Setup heartbeat
    const stopHeartbeat = setupHeartbeat(lifecycleHandler, lifecycleManager);

    // Build our destroy function
    const destroy = async () => {
        // Stop heartbeat
        stopHeartbeat();
        // Cleanup the RPC client
        rpcClient.cleanup();
        // Cleanup the lifecycle handler
        lifecycleHandler.cleanup();
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
        lifecycleHandler,
        lifecycleManager,
    }).then(() => debugInfo.updateSetupStatus(true));

    return {
        config,
        debugInfo,
        waitForConnection: lifecycleManager.isConnected,
        waitForSetup,
        request,
        listenerRequest,
        destroy,
        openPanel,
    };
}

/**
 * Setup the heartbeat
 * @param lifecycleHandler
 * @param lifecycleManager
 */
function setupHeartbeat(
    lifecycleHandler: LifecycleMessageHandler,
    lifecycleManager: IframeLifecycleManager
) {
    const HEARTBEAT_INTERVAL = 100; // Send heartbeat every 100ms until we are connected
    const HEARTBEAT_TIMEOUT = 30_000; // 30 seconds timeout
    let heartbeatInterval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const sendHeartbeat = () =>
        lifecycleHandler.sendLifecycleEvent({
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
 * @param config
 * @param lifecycleHandler
 * @param lifecycleManager
 */
async function postConnectionSetup({
    config,
    lifecycleHandler,
    lifecycleManager,
}: {
    config: FrakWalletSdkConfig;
    lifecycleManager: IframeLifecycleManager;
    lifecycleHandler: LifecycleMessageHandler;
}): Promise<void> {
    // Wait for the handler to be connected
    await lifecycleManager.isConnected;

    // Push raw CSS if needed
    async function pushCss() {
        const cssLink = config.customizations?.css;
        if (!cssLink) return;

        lifecycleHandler.sendLifecycleEvent({
            clientLifecycle: "modal-css",
            data: { cssLink },
        });
    }

    // Push i18n if needed
    async function pushI18n() {
        const i18n = config.customizations?.i18n;
        if (!i18n) return;

        // Push the i18n for each language
        lifecycleHandler.sendLifecycleEvent({
            clientLifecycle: "modal-i18n",
            data: { i18n },
        });
    }

    // Push local backup if needed
    async function pushBackup() {
        if (typeof window === "undefined") return;

        const backup = window.localStorage.getItem(BACKUP_KEY);
        if (!backup) return;

        lifecycleHandler.sendLifecycleEvent({
            clientLifecycle: "restore-backup",
            data: { backup },
        });
    }

    await Promise.allSettled([pushCss(), pushI18n(), pushBackup()]);
}
