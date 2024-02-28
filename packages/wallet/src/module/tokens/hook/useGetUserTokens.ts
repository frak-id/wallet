"use client";

import { getUserErc20Tokens } from "@/context/tokens/action/getTokenAsset";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery } from "@tanstack/react-query";

export function useGetUserTokens() {
    const { address } = useWallet();

    const { data, error } = useQuery({
        queryKey: ["getUserTokens", address],
        queryFn: async () => {
            if (!address) {
                return;
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
    };
}
