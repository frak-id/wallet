import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { pushBackupData } from "@/context/sdk/utils/backup";
import type {
    IFrameRequestResolver,
    IFrameResolvingContext,
    IFrameResponseEmitter,
} from "@/context/sdk/utils/iFrameRequestResolver";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useCallback } from "react";

type OnListenToWallet = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_listenToWalletStatus" }
    >
>;

/**
 * Hook use to listen to the wallet status
 */
export function useWalletStatusListener(): OnListenToWallet {
    /**
     * Emit the current wallet status
     * @param emitter
     */
    const emitCurrentStatus = useCallback(
        async (
            context: IFrameResolvingContext,
            emitter: IFrameResponseEmitter<{
                method: "frak_listenToWalletStatus";
            }>
        ) => {
            // Fetch the current session directly
            const currentSession = jotaiStore.get(sessionAtom);

            // If no wallet present, just return the not logged in status
            if (!currentSession) {
                await emitter({
                    result: {
                        key: "not-connected",
                    },
                });
                // And push fresh backup data with no session
                await pushBackupData({
                    productId: context.productId,
                });
                return;
            }

            // Get the on chain status
            const interactionSession = await getSessionStatus({
                wallet: currentSession.address,
            }).then((interactionSession) =>
                interactionSession
                    ? {
                          startTimestamp: interactionSession.sessionStart,
                          endTimestamp: interactionSession.sessionEnd,
                      }
                    : undefined
            );

            // Emit the event
            await emitter({
                result: {
                    key: "connected",
                    wallet: currentSession.address,
                    interactionToken:
                        jotaiStore.get(sdkSessionAtom)?.token ?? undefined,
                    interactionSession,
                },
            });

            // And push some backup data if we got ones
            await pushBackupData({
                productId: context.productId,
            });
        },
        []
    );

    /**
     * The function that will be called when a wallet status is requested
     * @param _
     * @param emitter
     */
    return useCallback(
        async (_, context, emitter) => {
            // Emit the first status
            await emitCurrentStatus(context, emitter);

            // Listen to jotai store update
            jotaiStore.sub(sessionAtom, () => {
                emitCurrentStatus(context, emitter);
            });
            jotaiStore.sub(sdkSessionAtom, () => {
                emitCurrentStatus(context, emitter);
            });
        },
        [emitCurrentStatus]
    );
}
