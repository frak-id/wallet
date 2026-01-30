import { useQuery } from "@tanstack/react-query";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";

type TokenMetadata = {
    name: string;
    symbol: string;
    decimals: number;
};

/**
 * Fetch on-chain ERC-20 metadata (name, symbol, decimals) for a single token.
 * Query key is per-token so results are cached independently.
 */
export function useTokenMetadata(tokenAddress?: Address) {
    return useQuery({
        queryKey: ["tokenMetadata", tokenAddress],
        queryFn: async (): Promise<TokenMetadata> => {
            if (!tokenAddress) {
                throw new Error("Token address is required");
            }

            const [name, symbol, decimals] = await multicall(viemClient, {
                contracts: [
                    {
                        abi: erc20Abi,
                        address: tokenAddress,
                        functionName: "name",
                    } as const,
                    {
                        abi: erc20Abi,
                        address: tokenAddress,
                        functionName: "symbol",
                    } as const,
                    {
                        abi: erc20Abi,
                        address: tokenAddress,
                        functionName: "decimals",
                    } as const,
                ],
                allowFailure: false,
            });

            return { name, symbol, decimals };
        },
        enabled: !!tokenAddress,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
    });
}
