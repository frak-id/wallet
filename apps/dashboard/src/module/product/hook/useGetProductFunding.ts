import { viemClient } from "@/context/blockchain/provider";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { indexerApi } from "@frak-labs/client/server";
import { useQuery } from "@tanstack/react-query";
import { type Address, type Hex, erc20Abi } from "viem";
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
};

/**
 * Mock bank data for demo mode
 */
const MOCK_BANKS: ProductBank[] = [
    {
        address: "0x1111111111111111111111111111111111111111" as Address,
        totalDistributed: BigInt("5000000000"), // 5,000 USDC (6 decimals)
        totalClaimed: BigInt("2500000000"), // 2,500 USDC
        isDistributing: true,
        balance: BigInt("12500000000"), // 12,500 USDC
        token: {
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
            name: "USD Coin",
            symbol: "USDC",
            decimals: 6,
        },
    },
    {
        address: "0x2222222222222222222222222222222222222222" as Address,
        totalDistributed: BigInt("3000000000000000000000"), // 3,000 DAI (18 decimals)
        totalClaimed: BigInt("1500000000000000000000"), // 1,500 DAI
        isDistributing: false,
        balance: BigInt("8500000000000000000000"), // 8,500 DAI
        token: {
            address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Address,
            name: "Dai Stablecoin",
            symbol: "DAI",
            decimals: 18,
        },
    },
];

/**
 * todo: should directly map to the prefered currency here?
 */
export function useGetProductFunding({ productId }: { productId?: Hex }) {
    const isDemoMode = useIsDemoMode();

    return useQuery({
        queryKey: [
            "product",
            "funding",
            productId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async () => {
            // Return mock data in demo mode
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                return MOCK_BANKS;
            }

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
            }));
        },
        enabled: !!productId,
    });
}
