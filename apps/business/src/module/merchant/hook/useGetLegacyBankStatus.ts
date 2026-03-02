import { useQuery } from "@tanstack/react-query";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";
import { viemClient } from "@/config/blockchain";
import { legacyCampaignBankAbi } from "@/module/merchant/utils/legacyBanks";

export function useGetLegacyBankStatus({
    oldBankAddress,
}: {
    oldBankAddress?: Address;
}) {
    return useQuery({
        queryKey: ["legacy-bank", oldBankAddress],
        queryFn: async () => {
            if (!oldBankAddress) {
                throw new Error("No legacy bank address");
            }

            const [token, totalPending, isDistributionEnabled] =
                await multicall(viemClient, {
                    contracts: [
                        {
                            address: oldBankAddress,
                            abi: legacyCampaignBankAbi,
                            functionName: "getToken",
                        } as const,
                        {
                            address: oldBankAddress,
                            abi: legacyCampaignBankAbi,
                            functionName: "getTotalPending",
                        } as const,
                        {
                            address: oldBankAddress,
                            abi: legacyCampaignBankAbi,
                            functionName: "isDistributionEnabled",
                        } as const,
                    ],
                    allowFailure: false,
                });

            const [balance] = await multicall(viemClient, {
                contracts: [
                    {
                        address: token,
                        abi: erc20Abi,
                        functionName: "balanceOf",
                        args: [oldBankAddress],
                    } as const,
                ],
                allowFailure: false,
            });

            const withdrawable =
                balance > totalPending ? balance - totalPending : 0n;

            return {
                token,
                balance,
                totalPending,
                withdrawable,
                isDistributionEnabled,
            };
        },
        enabled: !!oldBankAddress,
    });
}
