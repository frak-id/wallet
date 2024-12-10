import { viemClient } from "@/context/blockchain/provider";
import { indexerApi } from "@frak-labs/shared/context/server";
import { useQuery } from "@tanstack/react-query";
import { type Address, type Hex, erc20Abi, formatUnits } from "viem";
import { multicall } from "viem/actions";

type ApiResponse = {
    address: Address;
    totalDistributed: string; // bigint as string
    totalClaimed: string; // bigint as string
    isDistributing: boolean;
    token: {
        address: Address;
        name: string;
        symbol: string;
        decimals: number;
    };
}[];

export type ProductBank = {
    address: Address;
    totalDistributed: bigint;
    totalClaimed: bigint;
    isDistributing: boolean;
    balance: bigint;
    token: {
        address: Address;
        name: string;
        symbol: string;
        decimals: number;
    };
    formatted: {
        totalDistributed: string;
        totalClaimed: string;
        balance: string;
    };
};

export function useGetProductFunding({ productId }: { productId?: Hex }) {
    return useQuery({
        queryKey: ["product", "funding", productId],
        queryFn: async () => {
            const response = await indexerApi
                .get(`products/${productId}/banks`)
                .json<ApiResponse>();

            const balances = await multicall(viemClient, {
                contracts: response.map(
                    (funding) =>
                        ({
                            address: funding.token.address,
                            abi: erc20Abi,
                            functionName: "balanceOf",
                            args: [funding.address],
                        }) as const
                ),
                allowFailure: false,
            });

            // Return the response mapped
            return response.map((funding, index) => ({
                ...funding,
                totalDistributed: BigInt(funding.totalDistributed),
                totalClaimed: BigInt(funding.totalClaimed),
                isDistributing: funding.isDistributing,
                balance: balances[index],
                formatted: {
                    totalDistributed: formatUnits(
                        BigInt(funding.totalDistributed),
                        funding.token.decimals
                    ),
                    totalClaimed: formatUnits(
                        BigInt(funding.totalClaimed),
                        funding.token.decimals
                    ),
                    balance: formatUnits(
                        BigInt(balances[index]),
                        funding.token.decimals
                    ),
                },
            }));
        },
        enabled: !!productId,
    });
}
