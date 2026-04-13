import {
    addresses,
    currentStablecoinsList,
    rewarderHubAbi,
} from "@frak-labs/app-essentials";
import { claimableKey, currentViemClient } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { erc20Abi, formatUnits } from "viem";
import { multicall } from "viem/actions";
import { useConnection } from "wagmi";

export function useGetPendingRewards() {
    const { address } = useConnection();

    // Fetch claimable amounts + decimals for all known stablecoins via on-chain multicall
    const { data: pendingRewards, ...queryData } = useQuery({
        queryKey: claimableKey.pending.byAddress(address),
        queryFn: async () => {
            if (!address) return [];

            // Batch claimable + decimals calls in a single multicall
            const contracts = currentStablecoinsList.flatMap(
                (token) =>
                    [
                        {
                            address: addresses.rewarderHub,
                            abi: rewarderHubAbi,
                            functionName: "getClaimable",
                            args: [address, token],
                        },
                        {
                            address: token,
                            abi: erc20Abi,
                            functionName: "decimals",
                        },
                    ] as const
            );

            const result = await multicall(currentViemClient, {
                contracts,
                allowFailure: false,
            });

            // Results alternate: [claimable0, decimals0, claimable1, decimals1, ...]
            return currentStablecoinsList
                .map((token, index) => ({
                    token,
                    amount: result[index * 2] as bigint,
                    decimals: result[index * 2 + 1] as number,
                }))
                .filter((item) => item.amount > 0n);
        },
        enabled: !!address,
        // Volatile on-chain state — must always fetch fresh, never persist to localStorage
        meta: { storable: false },
    });

    // Calculate total claimable in fiat (stablecoins ~1:1)
    const totalClaimable = useMemo(() => {
        if (!pendingRewards?.length) return 0;
        return pendingRewards.reduce(
            (sum, item) =>
                sum + Number(formatUnits(item.amount, item.decimals)),
            0
        );
    }, [pendingRewards]);

    return {
        totalClaimable,
        pendingRewards,
        queryData,
    };
}
