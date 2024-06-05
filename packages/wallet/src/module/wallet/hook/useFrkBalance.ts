import { addresses } from "@/context/blockchain/addresses";
import { frakChainId } from "@/context/blockchain/provider";
import { getErc20Balance } from "@/context/tokens/action/getBalance";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Address, formatEther } from "viem";

export function useFrkBalance({ wallet }: { wallet?: Address }) {
    /**
     * Listen to the balance of the user
     */
    const { data: balance, refetch: refreshBalance } = useQuery({
        queryKey: ["frk-balance", wallet ?? "no-wallet"],
        queryFn: async () => {
            if (!wallet) {
                return 0n;
            }

            return getErc20Balance({
                wallet,
                chainId: frakChainId,
                token: addresses.paywallToken,
            });
        },
        // Only enable the hook if the smart wallet is present
        enabled: !!wallet,
        // Refetch every minute, will be available once wagmi is updated (and should then be moved into a query sub object)
        refetchInterval: 60_000,
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
