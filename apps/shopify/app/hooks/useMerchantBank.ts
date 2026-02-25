import {
    campaignBankAbi,
    currentStablecoins,
} from "@frak-labs/app-essentials/blockchain";
import { useQuery } from "@tanstack/react-query";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";
import { viemClient } from "../utils/viemClient";

export type TokenData = {
    symbol: string;
    address: Address;
    balance: bigint;
    allowance: bigint;
    decimals: number;
};

export function useMerchantBank({
    bankAddress,
}: {
    bankAddress?: Address | null;
}) {
    return useQuery({
        queryKey: ["merchant-bank", bankAddress],
        enabled: !!bankAddress,
        queryFn: async () => {
            if (!bankAddress) {
                return { isOpen: false, tokens: [] as TokenData[] };
            }

            const stablecoinEntries = Object.entries(currentStablecoins);

            const multicallContracts = [
                {
                    address: bankAddress,
                    abi: campaignBankAbi,
                    functionName: "isOpen",
                } as const,
                ...stablecoinEntries.flatMap(
                    ([, tokenAddress]) =>
                        [
                            {
                                address: bankAddress,
                                abi: campaignBankAbi,
                                functionName: "getBalance",
                                args: [tokenAddress],
                            } as const,
                            {
                                address: bankAddress,
                                abi: campaignBankAbi,
                                functionName: "getAllowance",
                                args: [tokenAddress],
                            } as const,
                            {
                                address: tokenAddress as Address,
                                abi: erc20Abi,
                                functionName: "decimals",
                            } as const,
                        ] as const
                ),
            ];

            const results = await multicall(viemClient, {
                contracts: multicallContracts,
                allowFailure: false,
            });

            const isOpen = results[0] as boolean;
            const tokenResults = results.slice(1);

            const tokens = stablecoinEntries.map(([symbol, address], index) => {
                const base = index * 3;
                return {
                    symbol,
                    address: address as Address,
                    balance: tokenResults[base] as bigint,
                    allowance: tokenResults[base + 1] as bigint,
                    decimals: tokenResults[base + 2] as number,
                };
            });

            return { isOpen, tokens };
        },
        select: (data) => ({
            ...data,
            tokens: data.tokens.map((token) => ({
                ...token,
                balance: BigInt(token.balance),
                allowance: BigInt(token.allowance),
            })),
        }),
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
    });
}
