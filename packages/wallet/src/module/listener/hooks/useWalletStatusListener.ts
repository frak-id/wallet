import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import type { Session } from "@/types/Session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
    RpcResponse,
    WalletStatusReturnType,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { atom, useAtomValue } from "jotai/index";
import { useCallback, useEffect } from "react";

type OnListenToWallet = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_listenToWalletStatus" }
    >
>;

/**
 * Atom representing the current wallet listener
 */
const walletListenerEmitterAtom = atom<{
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_listenToWalletStatus">
    ) => Promise<void>;
} | null>(null);

/**
 * Hook use to listen to the wallet status
 */
export function useWalletStatusListener() {
    /**
     * The current wallet status state
     */
    const [listener, setListener] = useAtom(walletListenerEmitterAtom);

    /**
     * Get the current user session
     */
    const session = useAtomValue(sessionAtom);

    /**
     * Get the current interaction session status
     */
    const { data: interactionSession } = useInteractionSessionStatus({
        address: session?.wallet?.address,
    });

    /**
     * The function that will be called when a wallet status is requested
     * @param _
     * @param emitter
     */
    const onWalletListenRequest: OnListenToWallet = useCallback(
        async (_, emitter) => {
            // Save our emitter, this will trigger session and balance fetching
            setListener({ emitter });
        },
        [setListener]
    );

    /**
     * Send the updated state every time we got one
     */
    useEffect(() => {
        // If we don't have an emitter, early exit
        if (!listener) return;

        // Build the wallet status and emit it
        const walletStatus = buildWalletStatus(
            session,
            interactionSession ?? undefined
        );
        listener.emitter({ result: walletStatus });
    }, [listener, interactionSession, session]);

    /**
     * Build the wallet status
     */
    function buildWalletStatus(
        session?: Session | null,
        interactionSession?: {
            sessionStart: Date;
            sessionEnd: Date;
        }
    ): WalletStatusReturnType {
        const wallet = session?.wallet?.address;

        // If no wallet present, just return the not logged in status
        if (!wallet) {
            return {
                key: "not-connected",
            };
        }

        // Format the interaction session if present
        const formattedInteractionSession = interactionSession
            ? {
                  startTimestamp: interactionSession.sessionStart.getTime(),
                  endTimestamp: interactionSession.sessionEnd.getTime(),
              }
            : undefined;

        // Otherwise, return hte logged in status
        return {
            key: "connected",
            wallet,
            interactionSession: formattedInteractionSession,
        };
    }

    return {
        onWalletListenRequest,
    };
}
