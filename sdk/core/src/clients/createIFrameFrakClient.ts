import { type ExtractedParametersFromRpc, FrakRpcError } from "../types";
import type { FrakClient } from "../types/client";
import type { FrakWalletSdkConfig } from "../types/config";
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
    const frakWalletUrl = config?.walletUrl ?? "https://wallet.frak.id";
    const lifecycleManager = createIFrameLifecycleManager({
        iframe,
        frakWalletUrl,
    });

    // Build our message handler
    const messageHandler = createIFrameMessageHandler({
        frakWalletUrl,
        iframe,
        channelManager,
        iframeLifecycleManager: lifecycleManager,
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
        const channelId = channelManager.createChannel(async (message) => {
            // Decompress the message
            const decompressed = await decompressDataAndCheckHash<
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
        const compressedMessage = await hashAndCompressData(args);

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
        const channelId = channelManager.createChannel(async (message) => {
            // Decompress the message
            const decompressed = await decompressDataAndCheckHash<
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
        const compressedMessage = await hashAndCompressData(args);

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

    // Perform the post connection setup
    const waitForSetup = postConnectionSetup({
        config,
        messageHandler,
        lifecycleManager,
    });

    return {
        config,
        waitForConnection: lifecycleManager.isConnected,
        waitForSetup,
        request,
        listenerRequest,
        destroy,
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
            iframeLifecycle: "heartbeat",
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
export async function postConnectionSetup({
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
    const pushCss = async () => {
        const cssLink = config.metadata.css;
        if (!cssLink) return;

        messageHandler.sendEvent({
            clientLifecycle: "modal-css",
            data: { cssLink },
        });
    };

    // Push local backup if needed
    const pushBackup = async () => {
        if (typeof window === "undefined") return;

        const backup = window.localStorage.getItem(BACKUP_KEY);
        if (!backup) return;

        messageHandler.sendEvent({
            clientLifecycle: "restore-backup",
            data: { backup },
        });
    };

    await Promise.all([pushCss(), pushBackup()]);
}
