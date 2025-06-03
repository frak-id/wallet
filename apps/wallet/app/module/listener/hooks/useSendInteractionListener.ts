import type { IFrameRequestResolver } from "@/module/sdk/utils/iFrameRequestResolver";
import { usePushInteraction } from "@/module/wallet/hook/usePushInteraction";
import { isRunningLocally } from "@frak-labs/app-essentials";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    RpcErrorCodes,
} from "@frak-labs/core-sdk";
import { useCallback } from "react";

type OnInteractionRequest = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_sendInteraction" }
    >
>;

/**
 * Hook use to listen to the user interactions
 */
export function useSendInteractionListener(): OnInteractionRequest {
    const pushInteraction = usePushInteraction();

    /**
     * The function that will be called when a user referred is requested
     * @param request
     * @param emitter
     */
    return useCallback(
        async (request, context, emitter) => {
            // Extract the productId and walletAddress
            const productId = request.params[0];
            const interaction = request.params[1];
            const signature = request.params[2];

            // If no productId or interaction, return
            if (!(productId && interaction)) {
                return;
            }

            if (BigInt(productId) !== BigInt(context.productId)) {
                console.error(
                    "Mismatching product id, aborting the user op reception",
                    { productId, context: context }
                );
                if (!isRunningLocally) {
                    await emitter({
                        error: {
                            code: RpcErrorCodes.configError,
                            message: "Mismatching product id",
                        },
                    });
                    return;
                }
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
                    await emitter({
                        error: {
                            code: RpcErrorCodes.walletNotConnected,
                            message: "User isn't connected",
                        },
                    });
                    return;
                case "no-sdk-session":
                    await emitter({
                        error: {
                            code: RpcErrorCodes.serverErrorForInteractionDelegation,
                            message: "Unable to get a safe token",
                        },
                    });
                    return;
                case "push-error":
                    await emitter({
                        error: {
                            code: RpcErrorCodes.serverErrorForInteractionDelegation,
                            message: "Unable to push the interaction",
                        },
                    });
                    return;
                case "success":
                    await emitter({
                        result: { delegationId },
                    });
                    return;
            }
        },
        [pushInteraction]
    );
}
