import { useQuery } from "@tanstack/react-query";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";
import { viemClient } from "~/module/common/lib/blockchain";

export function useToken(address: Address) {
    const { data, isLoading } = useQuery({
        queryKey: ["token", address],
        queryFn: async () => {
            const [name, symbol, decimals] = await multicall(viemClient, {
                contracts: [
                    {
                        abi: erc20Abi,
                        address: address,
                        functionName: "name",
                        args: [],
                    } as const,
                    {
                        abi: erc20Abi,
                        address: address,
                        functionName: "symbol",
                        args: [],
                    } as const,
                    {
                        abi: erc20Abi,
                        address: address,
                        functionName: "decimals",
                        args: [],
                    } as const,
                ],
                allowFailure: false,
            });

            return {
                name,
                symbol,
                decimals,
            };
        },
    });

    return {
        token: data,
        isLoading,
    };
}
