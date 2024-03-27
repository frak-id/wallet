"use client";

import { getUserErc20Tokens } from "@/context/tokens/action/getTokenAsset";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";

export function useGetUserTokens() {
    const { address } = useWallet();
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
