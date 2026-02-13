import {
    campaignBankAbi,
    currentStablecoins,
} from "@frak-labs/app-essentials/blockchain";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { multicall } from "viem/actions";
import { authenticatedBackendApi } from "@/api/backendClient";
import { viemClient } from "@/config/blockchain";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

const MOCK_MERCHANT_BANK = {
    deployed: true,
    bankAddress: "0x1111111111111111111111111111111111111111" as Address,
    isManager: true,
    isOpen: true,
    tokens: [
        {
            symbol: "eure",
            address: currentStablecoins.eure,
            balance: 5000000000n,
            allowance: 10000000000n,
        },
        {
            symbol: "gbpe",
            address: currentStablecoins.gbpe,
            balance: 3000000000n,
            allowance: 8000000000n,
        },
        {
            symbol: "usde",
            address: currentStablecoins.usde,
            balance: 0n,
            allowance: 0n,
        },
        {
            symbol: "usdc",
            address: currentStablecoins.usdc,
            balance: 0n,
            allowance: 0n,
        },
    ],
};

export function useGetMerchantBank({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();

    return useQuery({
        queryKey: ["merchant", merchantId, "bank"],
        queryFn: async () => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                return MOCK_MERCHANT_BANK;
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .bank.get();

            if (error) {
                throw new Error("Failed to fetch merchant bank");
            }

            if (!data) {
                throw new Error("No bank data returned");
            }

            const { deployed, bankAddress, ownerHasManagerRole } = data;

            if (!deployed || !bankAddress) {
                return {
                    deployed,
                    bankAddress: null,
                    isManager: ownerHasManagerRole,
                    isOpen: null,
                    tokens: [],
                };
            }

            const stablecoinEntries = Object.entries(currentStablecoins);
            const multicallContracts = [
                {
                    address: bankAddress,
                    abi: campaignBankAbi,
                    functionName: "isOpen",
                } as const,
                ...stablecoinEntries.flatMap(([, tokenAddress]) => [
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
                ]),
            ];

            const results = await multicall(viemClient, {
                contracts: multicallContracts,
                allowFailure: false,
            });

            const isOpen = results[0] as boolean;
            const tokenResults = results.slice(1);

            const tokens = stablecoinEntries.map(([symbol, address], index) => {
                const balanceIndex = index * 2;
                const allowanceIndex = index * 2 + 1;

                return {
                    symbol,
                    address: address as Address,
                    balance: tokenResults[balanceIndex] as bigint,
                    allowance: tokenResults[allowanceIndex] as bigint,
                };
            });

            return {
                deployed,
                bankAddress,
                isManager: ownerHasManagerRole,
                isOpen,
                tokens,
            };
        },
        enabled: !!merchantId,
        select: (data) => ({
            ...data,
            tokens: data.tokens.map((token) => ({
                ...token,
                balance: BigInt(token.balance),
                allowance: BigInt(token.allowance),
            })),
        }),
    });
}
