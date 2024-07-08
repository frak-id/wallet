import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import { walletListenerEmitterAtom } from "@/module/listener/atoms/walletListener";
import type { Session } from "@/types/Session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
    WalletStatusReturnType,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useAtomValue } from "jotai/index";
import { useCallback, useEffect } from "react";

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
     * The current wallet status state
     */
    const [listener, setListener] = useAtom(walletListenerEmitterAtom);

    /**
     * Get the current user session
     */
    const session = useAtomValue(sessionAtom);

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
        const walletStatus = buildWalletStatus(session);
        listener.emitter({ result: walletStatus });
    }, [listener, session]);

    /**
     * Build the wallet status
     */
    function buildWalletStatus(
        session?: Session | null
    ): WalletStatusReturnType {
        const wallet = session?.wallet?.address;

        // If no wallet present, just return the not logged in status
        if (!wallet) {
            return {
                key: "not-connected",
            };
        }

        // Otherwise, return hte logged in status
        return {
            key: "connected",
            wallet,
        };
    }

    return {
        onWalletListenRequest,
    };
}
