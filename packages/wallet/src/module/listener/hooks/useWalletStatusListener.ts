import { addresses } from "@/context/common/blockchain/addresses";
import { frakTokenAbi } from "@/context/common/blockchain/frak-abi";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { useSession } from "@/module/common/hook/useSession";
import type { Session } from "@/types/Session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
    WalletStatusReturnType,
} from "@frak-labs/nexus-sdk/core";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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
    const [emitter, setEmitter] = useState<
        | { emitter: (response: WalletStatusReturnType) => Promise<void> }
        | undefined
    >(undefined);

    /**
     * Get the current user session
     */
    const { session, isFetchingSession } = useSession({
        enabled: emitter !== undefined,
    });

    /**
     * Listen to the current session FRK balance if needed
     */
    const { data: walletFrkBalance, isLoading: isFetchingBalance } =
        useReadContract({
            abi: frakTokenAbi,
            address: addresses.frakToken,
            functionName: "balanceOf",
            args: [session?.wallet?.address ?? "0x0"],
            blockTag: "pending",
            // Some query options
            query: {
                enabled: session?.wallet?.address !== undefined,
            },
        });

    /**
     * The function that will be called when a wallet status is requested
     * @param _
     * @param emitter
     */
    const onWalletListenRequest: OnListenToWallet = useCallback(
        async (_, emitter) => {
            // Save our emitter, this will trigger session and balance fetching
            setEmitter({ emitter });
        },
        []
    );

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
            frkBalanceAsHex: toHex(walletFrkBalance ?? 0n),
        };
    }

    /**
     * Emit an updated version of the wallet status every time on our props has changed
     */
    useQuery({
        queryKey: [
            "walletStatusAutoEmitter",
            session?.wallet?.address ?? "no-wallet",
            toHex(walletFrkBalance ?? 0n),
        ],
        queryFn: () => {
            // Early exit if no emitter
            if (!emitter) {
                return;
            }

            // Early exit if fetching datas
            if (isFetchingSession || isFetchingBalance) {
                return;
            }

            // Build the wallet status and emit it
            const walletStatus = buildWalletStatus(session, walletFrkBalance);
            return emitter.emitter(walletStatus);
        },
        enabled: !!emitter && !isFetchingSession && !isFetchingBalance,
    });

    return {
        onWalletListenRequest,
    };
}
