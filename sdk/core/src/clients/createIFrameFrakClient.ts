import { OpenPanel } from "@openpanel/web";
import { type ExtractedParametersFromRpc, FrakRpcError } from "../types";
import type { FrakClient } from "../types/client";
import type { FrakWalletSdkConfig, EnhancedI18nConfig, I18nConfig } from "../types/config";
import type { IFrameRpcSchema } from "../types/rpc";
import { InternalError, RpcErrorCodes } from "../types/rpc/error";
import type {
    ListenerRequestFn,
    RequestFn,
    RpcResponse,
} from "../types/transport";
import { Deferred } from "../utils/Deferred";
import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "../utils/compression";
import { BACKUP_KEY } from "../utils/constants";
import { DebugInfoGatherer } from "./DebugInfo";
import { createIFrameChannelManager } from "./transports/iframeChannelManager";
import {
    type IframeLifecycleManager,
    createIFrameLifecycleManager,
} from "./transports/iframeLifecycleManager";
import {
    type IFrameMessageHandler,
    createIFrameMessageHandler,
} from "./transports/iframeMessageHandler";

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
    // Build our channel manager
    const channelManager = createIFrameChannelManager();
    const lifecycleManager = createIFrameLifecycleManager({ iframe });

    // Create our debug info gatherer
    const debugInfo = new DebugInfoGatherer(config, iframe);

    // Build our message handler
    const messageHandler = createIFrameMessageHandler({
        frakWalletUrl: config?.walletUrl ?? "https://wallet.frak.id",
        iframe,
        channelManager,
        iframeLifecycleManager: lifecycleManager,
        debugInfo,
    });

    // Build our request function
    const request: RequestFn<IFrameRpcSchema> = async <_, TResult>(
        args: ExtractedParametersFromRpc<IFrameRpcSchema>
    ) => {
        // Ensure the iframe is init
        const isConnected = await lifecycleManager.isConnected;
        if (!isConnected) {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        }

        // Create the deferrable result
        const result = new Deferred<TResult>();

        // Create the channel
        const channelId = channelManager.createChannel((message) => {
            // Decompress the message
            const decompressed = decompressDataAndCheckHash<
                RpcResponse<IFrameRpcSchema>
            >(message.data);
            // If it contains an error, reject it
            if (decompressed.error) {
                result.reject(
                    new FrakRpcError(
                        decompressed.error.code,
                        decompressed.error.message,
                        decompressed.error?.data
                    )
                );
            } else {
                // Otherwise, resolve with the right status
                result.resolve(decompressed.result as TResult);
            }
            // Then close the channel
            channelManager.removeChannel(channelId);
        });

        // Compress the message to send
        const compressedMessage = hashAndCompressData(args);

        // Send the message to the iframe
        messageHandler.sendEvent({
            id: channelId,
            topic: args.method,
            data: compressedMessage,
        });

        return result.promise;
    };

    // Build our listener function
    const listenerRequest: ListenerRequestFn<IFrameRpcSchema> = async <
        _,
        TResult,
    >(
        args: ExtractedParametersFromRpc<IFrameRpcSchema>,
        callback: (result: TResult) => void
    ) => {
        // Ensure the iframe is init
        const isConnected = await lifecycleManager.isConnected;
        if (!isConnected) {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        }

        // Create the channel
        const channelId = channelManager.createChannel((message) => {
            // Decompress the message
            const decompressed = decompressDataAndCheckHash<
                RpcResponse<IFrameRpcSchema>
            >(message.data);
            // Transmit the result if it's a success
            if (decompressed.result) {
                callback(decompressed.result as TResult);
            } else {
                throw new InternalError("No valid result in the response");
            }
        });

        // Compress the message to send
        const compressedMessage = hashAndCompressData(args);

        // Send the message to the iframe
        messageHandler.sendEvent({
            id: channelId,
            topic: args.method,
            data: compressedMessage,
        });
    };

    // Setup heartbeat
    const stopHeartbeat = setupHeartbeat(messageHandler, lifecycleManager);

    // Build our destroy function
    const destroy = async () => {
        // Stop heartbeat
        stopHeartbeat();
        // Destroy the channel manager
        channelManager.destroy();
        // Cleanup the message handler
        messageHandler.cleanup();
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
        messageHandler,
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
 * @param messageHandler
 * @param lifecycleManager
 */
function setupHeartbeat(
    messageHandler: IFrameMessageHandler,
    lifecycleManager: IframeLifecycleManager
) {
    const HEARTBEAT_INTERVAL = 100; // Send heartbeat every 100ms until we are connected
    const HEARTBEAT_TIMEOUT = 30_000; // 30 seconds timeout
    let heartbeatInterval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const sendHeartbeat = () =>
        messageHandler.sendEvent({
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
 * @param messageHandler
 * @param lifecycleManager
 */
async function postConnectionSetup({
    config,
    messageHandler,
    lifecycleManager,
}: {
    config: FrakWalletSdkConfig;
    lifecycleManager: IframeLifecycleManager;
    messageHandler: IFrameMessageHandler;
}): Promise<void> {
    // Wait for the handler to be connected
    await lifecycleManager.isConnected;

    // Push raw CSS if needed
    async function pushCss() {
        const cssLink = config.customizations?.css;
        if (!cssLink) return;

        messageHandler.sendEvent({
            clientLifecycle: "modal-css",
            data: { cssLink },
        });
    }

    // Push i18n if needed
    async function pushI18n() {
        const i18n = config.customizations?.i18n;
        if (!i18n) return;

        // If it's an EnhancedI18nConfig, we need to resolve it to a regular I18nConfig
        // For now, we'll use the global config from the enhanced config, or fall back to regular config
        let resolvedI18n: I18nConfig;
        if (typeof i18n === "object" && !Array.isArray(i18n) && ("global" in i18n || "campaigns" in i18n)) {
            // It's an EnhancedI18nConfig
            const enhancedConfig = i18n as EnhancedI18nConfig;
            resolvedI18n = enhancedConfig.global || {};
        } else {
            // It's a regular I18nConfig
            resolvedI18n = i18n as I18nConfig;
        }

        // Push the i18n for each language
        messageHandler.sendEvent({
            clientLifecycle: "modal-i18n",
            data: { i18n: resolvedI18n },
        });
    }

    // Push local backup if needed
    async function pushBackup() {
        if (typeof window === "undefined") return;

        const backup = window.localStorage.getItem(BACKUP_KEY);
        if (!backup) return;

        messageHandler.sendEvent({
            clientLifecycle: "restore-backup",
            data: { backup },
        });
    }

    await Promise.allSettled([pushCss(), pushI18n(), pushBackup()]);
}
