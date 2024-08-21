"use client";

import {
    getUserErc20Tokens,
    invalidateUserErc20Tokens,
} from "@/context/tokens/action/getTokenAsset";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAccount } from "wagmi";

export function useGetUserTokens() {
    const { address } = useAccount();

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

export function useInvalidateUserTokens() {
    const queryClient = useQueryClient();

    return useCallback(async () => {
        // Invalidate the user tokens server side
        await invalidateUserErc20Tokens();

        // Invalidate the user tokens client side
        await queryClient.invalidateQueries({
            queryKey: ["getUserTokens"],
            exact: false,
        });
    }, [queryClient]);
}
