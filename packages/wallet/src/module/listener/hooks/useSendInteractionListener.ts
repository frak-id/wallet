import { pushInteraction } from "@/context/interaction/action/pushInteraction";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import { addPendingInteractionAtom } from "@/module/wallet/atoms/pendingInteraction";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    RpcErrorCodes,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { tryit } from "radash";
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
    /**
     * The function that will be called when a user referred is requested
     * @param request
     * @param emitter
     */
    return useCallback(async (request, _, emitter) => {
        // Extract the productId and walletAddress
        const productId = request.params[0];
        const interaction = request.params[1];
        const signature = request.params[2];

        // If no productId or interaction, return
        if (!(productId && interaction)) {
            return;
        }

        const userAddress = jotaiStore.get(sessionAtom)?.wallet?.address;

        // If no current wallet present
        if (!userAddress) {
            // Save the pending interaction
            jotaiStore.set(addPendingInteractionAtom, {
                productId,
                interaction,
                signature,
                timestamp: Date.now(),
            });
            // Send the response
            await emitter({
                error: {
                    code: RpcErrorCodes.walletNotConnected,
                    message: "User isn't connected",
                },
            });
            // And exit
            return;
        }

        // Otherwise, just set the user referred on product
        const [, delegationId] = await tryit(() =>
            pushInteraction({
                wallet: userAddress,
                toPush: {
                    productId,
                    interaction,
                    submittedSignature: signature,
                },
            })
        )();

        if (!delegationId) {
            // todo: Check if the error is about no session or not
            // Send the response
            await emitter({
                error: {
                    code: RpcErrorCodes.noInteractionSession,
                    message: "User doesn't have an interaction session",
                },
            });
            return;
        }

        // Send the response
        await emitter({
            result: { delegationId },
        });
    }, []);
}
