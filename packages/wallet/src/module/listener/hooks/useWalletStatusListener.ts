import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
    WalletStatusReturnType,
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
export function useWalletStatusListener() {
    /**
     * The function that will be called when a wallet status is requested
     * @param _
     * @param emitter
     */
    const onWalletListenRequest: OnListenToWallet = useCallback(
        async (_, emitter) => {
            // Fetch the current session directly
            const currentSession = jotaiStore.get(sessionAtom);

            // Build the wallet status and emit it
            const walletStatus = await buildWalletStatus(currentSession);

            // And emit it
            await emitter({ result: walletStatus });
        },
        []
    );

    /**
     * Build the wallet status
     */
    const buildWalletStatus = useCallback(
        async (session?: Session | null): Promise<WalletStatusReturnType> => {
            const wallet = session?.wallet?.address;

            // If no wallet present, just return the not logged in status
            if (!wallet) {
                return {
                    key: "not-connected",
                };
            }
            // Otherwise, fetch the interaction session status
            const interactionSession = await getSessionStatus({
                wallet,
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

            // Otherwise, return hte logged in status
            return {
                key: "connected",
                wallet,
                interactionSession: formattedInteractionSession,
            };
        },
        []
    );

    return {
        onWalletListenRequest,
    };
}
