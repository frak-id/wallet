import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
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
     * The function that will be called when a wallet status is requested
     * @param _
     * @param emitter
     */
    return useCallback(async (_, emitter) => {
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

        // Otherwise, fetch the interaction session status
        const interactionSession = await getSessionStatus({
            wallet: currentSession.wallet.address,
        });

        // Format the interaction session if present
        const formattedInteractionSession = interactionSession
            ? {
                  startTimestamp: new Date(
                      interactionSession.sessionStart
                  ).getTime(),
                  endTimestamp: new Date(
                      interactionSession.sessionEnd
                  ).getTime(),
              }
            : undefined;

        // And emit it
        await emitter({
            result: {
                key: "connected",
                wallet: currentSession.wallet.address,
                interactionSession: formattedInteractionSession,
            },
        });
    }, []);
}
