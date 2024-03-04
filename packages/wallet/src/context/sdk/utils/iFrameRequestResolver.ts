import {
    type ExtractedParametersFromRpc,
    type ExtractedReturnTypeFromRpc,
    type IFrameRpcEvent,
    type IFrameRpcSchema,
    type KeyProvider,
    decompressDataAndCheckHash,
    getIFrameResponseKeyProvider,
    hashAndCompressData,
} from "@frak-labs/nexus-sdk/core";

/**
 * Type for our iframe rpc response emitter
 */
export type IFrameResponseEmitter<
    TParameters extends
        ExtractedParametersFromRpc<IFrameRpcSchema> = ExtractedParametersFromRpc<IFrameRpcSchema>,
> = (
    result: ExtractedReturnTypeFromRpc<IFrameRpcSchema, TParameters>
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
        throw new Error("QueryProvider should be used in the browser");
    }

    // Listen to the window message
    const onMessage = async (message: MessageEvent<IFrameRpcEvent>) => {
        // TODO: Check that the origin match one of our providers
        console.log("Received a request message from in the iframe", {
            message,
        });

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

        // Get the right key provider for the given param
        const responseKeyProvider = getIFrameResponseKeyProvider({
            method: topic,
        });

        // Build the emitter for this call
        const responseEmitter: IFrameResponseEmitter = async (result) => {
            // Hash and compress the results
            const compressedResult = await hashAndCompressData(
                result,
                responseKeyProvider
            );

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
        const uncompressedData = await decompressDataAndCheckHash(
            data,
            getIframeRequestKeyProvider(message.data)
        );

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

/**
 * Get the right response key provider for the given param
 * @param event
 */
export function getIframeRequestKeyProvider(
    event: IFrameRpcEvent
): KeyProvider<ExtractedParametersFromRpc<IFrameRpcSchema>> {
    // Unlock options key
    if (event.topic === "frak_getArticleUnlockOptions") {
        return ((
            request: Extract<
                ExtractedParametersFromRpc<IFrameRpcSchema>,
                { method: "frak_getArticleUnlockOptions" }
            >
        ) => [
            "get-price",
            request.params[0],
            request.params[1],
        ]) as KeyProvider<ExtractedParametersFromRpc<IFrameRpcSchema>>;
    }

    // Wallet status key
    if (event.topic === "frak_listenToWalletStatus") {
        return ((
            _: Extract<
                ExtractedParametersFromRpc<IFrameRpcSchema>,
                { method: "frak_listenToWalletStatus" }
            >
        ) => ["wallet-status"]) as KeyProvider<
            ExtractedParametersFromRpc<IFrameRpcSchema>
        >;
    }

    // Article unlock status key
    if (event.topic === "frak_listenToArticleUnlockStatus") {
        return ((
            request: Extract<
                ExtractedParametersFromRpc<IFrameRpcSchema>,
                { method: "frak_listenToArticleUnlockStatus" }
            >
        ) => [
            "article-unlock-status",
            request.params[0],
            request.params[1],
        ]) as KeyProvider<ExtractedParametersFromRpc<IFrameRpcSchema>>;
    }

    throw new Error(`No key provider found for the event ${event}`);
}
