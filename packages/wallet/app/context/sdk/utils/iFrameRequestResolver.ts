import { restoreBackupData } from "@/context/sdk/utils/backup";
import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import {
    handleHandshakeResponse,
    iframeResolvingContextAtom,
    startFetchResolvingContextViaHandshake,
} from "@/module/atoms/resolvingContext";
import {
    type ClientLifecycleEvent,
    type ExtractedParametersFromRpc,
    type IFrameEvent,
    type IFrameRpcSchema,
    type RpcResponse,
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "@frak-labs/core-sdk";
import { jotaiStore } from "@module/atoms/store";
import { type Hex, keccak256, toHex } from "viem";

/**
 * The current resolving context
 */
export type IFrameResolvingContext = {
    productId: Hex;
    origin: string;
    sourceUrl: string;
    isAutoContext: boolean;
};

/**
 * Type for our iframe rpc response emitter
 */
export type IFrameResponseEmitter<
    TParameters extends
        ExtractedParametersFromRpc<IFrameRpcSchema> = ExtractedParametersFromRpc<IFrameRpcSchema>,
> = (
    result: RpcResponse<IFrameRpcSchema, TParameters["method"]>
) => Promise<void>;

/**
 * Type for our iframe rpc request resolver
 *  - Basically, accept a request of type Params, and return an emitter of the Response waited for the request
 */
export type IFrameRequestResolver<
    TParams extends
        ExtractedParametersFromRpc<IFrameRpcSchema> = ExtractedParametersFromRpc<IFrameRpcSchema>,
> = (
    params: TParams,
    context: IFrameResolvingContext,
    responseEmitter: IFrameResponseEmitter<TParams>
) => Promise<void>;

/**
 * The map for all the resolvers
 */
export type IFrameRequestResolverMap = {
    [K in ExtractedParametersFromRpc<IFrameRpcSchema>["method"]]: IFrameRequestResolver<
        Extract<ExtractedParametersFromRpc<IFrameRpcSchema>, { method: K }>
    >;
};

/**
 * Create our iframe request resolver
 */
export function createIFrameRequestResolver(
    resolversMap: IFrameRequestResolverMap
) {
    if (typeof window === "undefined") {
        throw new Error("IFrame resolver should be used in the browser");
    }
    if (!isInIframe()) {
        throw new Error("IFrame resolver should be used in an iframe");
    }

    // Listen to the window message
    const onMessage = async (message: MessageEvent<IFrameEvent>) => {
        // Check if the message data are object
        if (typeof message.data !== "object") {
            return;
        }

        // Check if that's a client lifecycle request event
        if (
            "clientLifecycle" in message.data ||
            "iframeLifecycle" in message.data
        ) {
            await handleLifecycleEvents(message, setReadyToHandleRequest);
            return;
        }

        // Recompute the product id associated with the message
        const productId = keccak256(toHex(new URL(message.origin).host));

        // Check if we got a current resolving context
        const currentContext = jotaiStore.get(iframeResolvingContextAtom);

        // Check if the product id matches (and only proceed if we got a safe context)
        if (productId !== currentContext?.productId) {
            console.error("Received a message from an unknown origin", {
                productId,
                currentContext,
            });
            return;
        }

        // Get the data
        const { id, topic, data } = message.data;
        if (!(id && topic)) {
            return;
        }

        // Get the resolver
        const resolver = resolversMap[topic];
        if (!resolver) {
            return;
        }

        // Build the emitter for this call
        const responseEmitter: IFrameResponseEmitter = async (result) => {
            // Hash and compress the results
            const compressedResult = await hashAndCompressData(result);

            // Then post the message and a response
            message.source?.postMessage(
                {
                    id,
                    topic,
                    data: compressedResult,
                },
                {
                    targetOrigin: message.origin,
                }
            );
        };

        // Decompress the data
        const uncompressedData = await decompressDataAndCheckHash(data);

        // Response to the requests
        // @ts-ignore
        await resolver(uncompressedData, currentContext, responseEmitter);
    };

    // Add the message listener
    window.addEventListener("message", onMessage);

    // Small cleanup function
    function destroy() {
        window.removeEventListener("message", onMessage);
    }

    // If we don't have any context, do the request do get one via handshake
    function isContextPresent() {
        // Get the context
        const currentContext = jotaiStore.get(iframeResolvingContextAtom);
        // If we don't have one, initiate the handshake + tell that we can't handle request yet
        if (!currentContext) {
            jotaiStore.set(startFetchResolvingContextViaHandshake);
            return false;
        }
        // We have an auto context, try to fetch a more precise one using the handshake
        if (currentContext.isAutoContext) {
            jotaiStore.set(startFetchResolvingContextViaHandshake);
        }
        return true;
    }

    // Helper to tell when we are ready to process message
    function setReadyToHandleRequest() {
        if (!isContextPresent()) {
            console.warn("Not ready to handle request yet");
            return;
        }
        // If we got a context, we are rdy to handle request
        emitLifecycleEvent({ iframeLifecycle: "connected" });
    }

    // Directly launch a context check
    isContextPresent();

    return {
        destroy,
        setReadyToHandleRequest,
    };
}

/**
 * Handle the lifecycle related message events
 * @param message
 * @param resolvingContext
 * @param setReadyToHandleRequest
 */
async function handleLifecycleEvents(
    message: MessageEvent<IFrameEvent>,
    setReadyToHandleRequest: () => void
) {
    // Check if that's an iframe lifecycle request event
    if (!("clientLifecycle" in message.data)) {
        console.error(
            "Received an iframe lifecycle event on the iframe side, dismissing it"
        );
        return;
    }

    // Extract the client lifecucle events data
    const clientMsg = message.data;
    const { clientLifecycle } = clientMsg;

    switch (clientLifecycle) {
        case "modal-css": {
            const style = document.createElement("link");
            style.rel = "stylesheet";
            style.href = clientMsg.data.cssLink;
            document.head.appendChild(style);
            return;
        }
        case "restore-backup": {
            const context = jotaiStore.get(iframeResolvingContextAtom);
            if (!context) {
                console.warn(
                    "Can't restore a backend until we are sure of the context"
                );
                return;
            }
            // Restore the backup
            await restoreBackupData({
                backup: clientMsg.data.backup,
                productId: context.productId,
            });
            return;
        }
        case "heartbeat": {
            // Tell that we are rdy to handle request
            setReadyToHandleRequest();
            return;
        }
        case "handshake-response": {
            // Set the handshake response
            const hasContext = jotaiStore.set(
                handleHandshakeResponse,
                message as MessageEvent<ClientLifecycleEvent>
            );
            // Once we got a context, we can tell that we are rdy to handle request
            if (hasContext) {
                setReadyToHandleRequest();
            }
            return;
        }
    }
}

/**
 * Simple helper to check if we currently are in an iframe
 */
function isInIframe() {
    if (typeof window === "undefined") {
        return false;
    }
    return window.self !== window.top;
}
