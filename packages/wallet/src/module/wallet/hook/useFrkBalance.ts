import { addresses } from "@/context/common/blockchain/addresses";
import { frakTokenAbi } from "@/context/common/blockchain/frak-abi";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMemo } from "react";
import { formatEther } from "viem";
import { polygonMumbai } from "viem/chains";
import { useReadContract } from "wagmi";

export function useFrkBalance() {
    /**
     * The current wallet
     */
    const { wallet } = useWallet();

    /**
     * Listen to the balance of the user
     */
    const { data: balance, refetch: refreshBalance } = useReadContract({
        abi: frakTokenAbi,
        address: addresses.frakToken,
        functionName: "balanceOf",
        args: [wallet?.address ?? "0x0"],
        // Target the mumbai chain
        chainId: polygonMumbai.id,
        // Get the data on the pending block, to get the fastest possible data
        blockTag: "pending",
        // Some query options
        query: {
            // Only enable the hook if the smart wallet is present
            enabled: !!wallet,
            // Refetch every minute, will be available once wagmi is updated (and should then be moved into a query sub object)
            refetchInterval: 60_000,
        },
    });

    return useMemo(
        () => ({
            balance: formatEther(balance ?? 0n),
            rawBalance: balance,
            refreshBalance,
        }),
        [balance, refreshBalance]
    );
}
