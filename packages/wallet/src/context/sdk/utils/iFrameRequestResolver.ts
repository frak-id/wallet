import {
    type ExtractedParametersFromRpc,
    type IFrameEvent,
    type IFrameRpcSchema,
    type RpcResponse,
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "@frak-labs/nexus-sdk/core";

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

    // Listen to the window message
    const onMessage = async (message: MessageEvent<IFrameEvent>) => {
        // TODO: Check that the origin match one of our providers
        // TODO: Populate the request with a bit of context??
        // TODO: Content id is just a hash of the origin.domain so we can totally parse it and check when needed?
        // TODO: - Like a few sensitive RPC only callable by minted content?
        // TODO: - Maybe a logic where content using the prod wallet need to have a stake somewhere?
        console.log("Received a request message from in the iframe", {
            message,
        });

        // Check if that's a lifecycle event
        if ("lifecycle" in message.data) {
            const { lifecycle, data } = message.data;

            // Check if that's a css lifecycle event and that we have data
            if (lifecycle === "css" && data) {
                const style = document.createElement("style");
                style.id = "nexus-wallet-css";
                style.appendChild(document.createTextNode(data));
                document.head.appendChild(style);
            }
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
        await resolver(uncompressedData, responseEmitter);
    };

    // Add the message listener
    window.addEventListener("message", onMessage);

    // Small cleanup function
    function destroy() {
        window.removeEventListener("message", onMessage);
    }

    // Helper to tell when we are ready to process message
    function setReadyToHandleRequest() {
        window.parent?.postMessage({ lifecycle: "connected" }, "*");
    }

    return {
        destroy,
        setReadyToHandleRequest,
    };
}
