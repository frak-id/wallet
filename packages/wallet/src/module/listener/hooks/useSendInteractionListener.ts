import { pushInteraction } from "@/context/interaction/action/pushInteraction";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import { addPendingInteractionAtom } from "@/module/wallet/atoms/pendingInteraction";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    RpcErrorCodes,
} from "@frak-labs/nexus-sdk/core";
import { useAtomValue, useSetAtom } from "jotai";
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
export function useSendInteractionListener() {
    /**
     * Get the current user session
     */
    const session = useAtomValue(sessionAtom);

    /**
     * Add the pending interaction to the list
     */
    const addPendingInteraction = useSetAtom(addPendingInteractionAtom);

    /**
     * The function that will be called when a user referred is requested
     * @param request
     * @param emitter
     */
    const onInteractionRequest: OnInteractionRequest = useCallback(
        async (request, emitter) => {
            // Extract the contentId and walletAddress
            const contentId = request.params[0];
            const interaction = request.params[1];
            const signature = request.params[2];
            const userAddress = session?.wallet?.address;

            // If no contentId or interaction, return
            if (!(contentId && interaction)) {
                return;
            }

            // If no current wallet present
            if (!userAddress) {
                // add to an interaction storage queue
                addPendingInteraction({
                    contentId,
                    interaction,
                    signature,
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

            // Otherwise, just set the user referred on content
            const [, txHash] = await tryit(() =>
                pushInteraction({
                    wallet: userAddress,
                    toPush: {
                        contentId,
                        interaction,
                        submittedSignature: signature,
                    },
                })
            )();

            if (!txHash) {
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
                result: { hash: txHash },
            });
        },
        [session?.wallet?.address, addPendingInteraction]
    );

    return {
        onInteractionRequest,
    };
}