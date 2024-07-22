import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import type {
    IFrameRequestResolver,
    IFrameResponseEmitter,
} from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
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
                return;
            }

            const interactionSession = await getSessionStatus({
                wallet: currentSession.wallet.address,
            });

            const formattedInteractionSession = interactionSession
                ? {
                      startTimestamp: interactionSession.sessionStart,
                      endTimestamp: interactionSession.sessionEnd,
                  }
                : undefined;

            await emitter({
                result: {
                    key: "connected",
                    wallet: currentSession.wallet.address,
                    interactionSession: formattedInteractionSession,
                },
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
        async (_, emitter) => {
            // Emit the first status
            await emitCurrentStatus(emitter);

            // Listen to jotai store update
            jotaiStore.sub(sessionAtom, () => {
                console.log("session update from jotai sub within context");
                emitCurrentStatus(emitter);
            });

            // todo: cleanup function
        },
        [emitCurrentStatus]
    );
}
