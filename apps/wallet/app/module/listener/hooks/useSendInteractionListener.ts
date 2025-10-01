import type { WalletRpcContext } from "@/module/listener/types/context";
import { usePushInteraction } from "@/module/wallet/hook/usePushInteraction";
import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/rpc";
import { useCallback } from "react";

type OnInteractionRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_sendInteraction",
    WalletRpcContext
>;

/**
 * Hook use to listen to the user interactions
 *
 * Note: ProductId validation now happens in walletContextMiddleware.
 * Context parameter contains validated productId, sourceUrl, etc.
 */
export function useSendInteractionListener(): OnInteractionRequest {
    const pushInteraction = usePushInteraction();

    /**
     * The function that will be called when a user referred is requested
     * Context is augmented by middleware with productId, sourceUrl, etc.
     */
    return useCallback(
        async (params, context) => {
            // Extract the productId and walletAddress
            const productId = params[0];
            const interaction = params[1];
            const signature = params[2];

            // If no productId or interaction, throw error
            if (!(productId && interaction)) {
                throw new Error("Missing productId or interaction");
            }

            // Additional validation: ensure the productId in params matches the context
            // (context.productId is already validated against origin by middleware)
            if (BigInt(productId) !== BigInt(context.productId)) {
                console.error(
                    "Product ID in params doesn't match validated context",
                    {
                        paramsProductId: productId,
                        contextProductId: context.productId,
                    }
                );
                throw new FrakRpcError(
                    RpcErrorCodes.configError,
                    "Product ID mismatch"
                );
            }

            // Push the interaction
            const { status, delegationId } = await pushInteraction({
                productId,
                interaction,
                signature,
            });

            // Depending on the status, return different things
            switch (status) {
                case "pending-wallet":
                    throw new FrakRpcError(
                        RpcErrorCodes.walletNotConnected,
                        "User isn't connected"
                    );
                case "no-sdk-session":
                    throw new FrakRpcError(
                        RpcErrorCodes.serverErrorForInteractionDelegation,
                        "Unable to get a safe token"
                    );
                case "push-error":
                    throw new FrakRpcError(
                        RpcErrorCodes.serverErrorForInteractionDelegation,
                        "Unable to push the interaction"
                    );
                case "success":
                    return { delegationId };
            }
        },
        [pushInteraction]
    );
}
