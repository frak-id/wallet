import { addresses } from "@/context/common/blockchain/addresses";
import { paywallTokenAbi } from "@/context/common/blockchain/poc-abi";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { useSession } from "@/module/common/hook/useSession";
import { walletListenerEmitterAtom } from "@/module/listener/atoms/walletListener";
import type { Session } from "@/types/Session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
    WalletStatusReturnType,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { toHex } from "viem";
import { useReadContract } from "wagmi";

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
    const { session, isFetchingSession } = useSession({
        enabled: !!listener,
    });

    /**
     * Listen to the current session FRK balance if needed
     */
    const { data: walletFrkBalance, refetch: refreshBalance } = useReadContract(
        {
            abi: paywallTokenAbi,
            address: addresses.paywallToken,
            functionName: "balanceOf",
            args: [session?.wallet?.address ?? "0x0"],
            // Some query options
            query: {
                enabled: !!session?.wallet?.address,
            },
        }
    );

    /**
     * The function that will be called when a wallet status is requested
     * @param _
     * @param emitter
     */
    const onWalletListenRequest: OnListenToWallet = useCallback(
        async (_, emitter) => {
            // Trigger a balance refresh, and wait for it
            await refreshBalance();
            // Save our emitter, this will trigger session and balance fetching
            setListener({ emitter });
            // Refetch session and frk balance on request
            refreshBalance();
        },
        [refreshBalance, setListener]
    );

    /**
     * Send the updated state every time we got one
     */
    useEffect(() => {
        // If we are fetching some data early exit
        if (isFetchingSession) return;

        // If we don't have an emitter, early exit
        if (!listener) return;

        // Build the wallet status and emit it
        const walletStatus = buildWalletStatus(session, walletFrkBalance);
        listener.emitter(walletStatus);
    }, [listener, session, walletFrkBalance, isFetchingSession]);

    /**
     * Build the wallet status
     */
    function buildWalletStatus(
        session?: Session | null,
        walletFrkBalance?: bigint
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
            frkBalanceAsHex: toHex(
                walletFrkBalance ? BigInt(walletFrkBalance) : 0n
            ),
        };
    }

    return {
        onWalletListenRequest,
    };
}
