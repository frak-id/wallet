"use client";

import { getUserErc20Tokens } from "@/context/tokens/action/getTokenAsset";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery } from "@tanstack/react-query";

export function useGetUserTokens() {
    const { address } = useWallet();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["getUserTokens", address ?? "no-address"],
        queryFn: async () => {
            if (!address) {
                return null;
            }
            return await getUserErc20Tokens({
                wallet: address,
            });
        },
        enabled: !!address,
    });

    return {
        tokens: data,
        error,
        isLoading,
        refetch,
    };
}
