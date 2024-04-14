"use client";

import { getUserErc20Tokens } from "@/context/tokens/action/getTokenAsset";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";

export function useGetUserTokens() {
    const { address } = useAccount();
    const chainId = useChainId();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: [
            "getUserTokens",
            address ?? "no-address",
            chainId ?? "no-chain",
        ],
        queryFn: async () => {
            if (!address) {
                return null;
            }
            return await getUserErc20Tokens({
                wallet: address,
                chainId,
            });
        },
        enabled: !!address && !!chainId,
    });

    return {
        tokens: data,
        error,
        isLoading,
        refetch,
    };
}
