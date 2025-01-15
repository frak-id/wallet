import { restoreBackupData } from "@/context/sdk/utils/backup";
import {
    getIFrameResolvingContext,
    isInIframe,
} from "@/context/sdk/utils/iframeContext";
import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import {
    type ExtractedParametersFromRpc,
    type IFrameEvent,
    type IFrameRpcSchema,
    type RpcResponse,
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "@frak-labs/core-sdk";
import { type Hex, keccak256, toHex } from "viem";

/**
 * The current resolving context
 */
export type IFrameResolvingContext = {
    productId: Hex;
    origin: string;
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

    // Get the resolving context
    const resolvingContext = getIFrameResolvingContext();

    // Listen to the window message
    const onMessage = async (message: MessageEvent<IFrameEvent>) => {
        // Recompute the product id associated with the message
        const productId = keccak256(toHex(new URL(message.origin).hostname));

        // If  it doesn't match the one computed from the iframe, exit
        if (productId !== resolvingContext?.productId) {
            console.error("Received a message from an unknown origin", {
                productId,
                resolvingContext,
            });
            return;
        }

        // Check if the message data are object
        if (typeof message.data !== "object") {
            return;
        }

        // Check if that's a client lifecycle request event
        if (
            "clientLifecycle" in message.data ||
            "iframeLifecycle" in message.data
        ) {
            await handleLifecycleEvents(
                message,
                resolvingContext,
                setReadyToHandleRequest
            );
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
        await resolver(uncompressedData, resolvingContext, responseEmitter);
    };

    // Add the message listener
    window.addEventListener("message", onMessage);

    // Small cleanup function
    function destroy() {
        window.removeEventListener("message", onMessage);
    }

    // Helper to tell when we are ready to process message
    function setReadyToHandleRequest() {
        emitLifecycleEvent({ iframeLifecycle: "connected" });
    }

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
    resolvingContext: IFrameResolvingContext,
    setReadyToHandleRequest: () => void
) {
    // Check if that's a client lifecycle request event
    if ("clientLifecycle" in message.data) {
        const { clientLifecycle, data } = message.data;

        switch (clientLifecycle) {
            case "modal-css": {
                const style = document.createElement("link");
                style.rel = "stylesheet";
                style.href = data.cssLink;
                document.head.appendChild(style);
                break;
            }
            case "restore-backup": {
                // Restore the backup
                await restoreBackupData({
                    backup: data.backup,
                    productId: resolvingContext.productId,
                });
                break;
            }
        }
        return;
    }

    // Check if that's an iframe lifecycle request event
    if ("iframeLifecycle" in message.data) {
        const { iframeLifecycle } = message.data;
        if (iframeLifecycle === "heartbeat") {
            setReadyToHandleRequest();
            return;
        }

        console.error(
            "Received an iframe lifecycle event on the iframe side, dismissing it"
        );
        return;
    }
}
