import { interactionCampaignAbi } from "@frak-labs/app-essentials";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { multicall } from "viem/actions";
import { viemClient } from "~/module/common/lib/blockchain";

export function useHasActiveCampaign(addresses: Address[]) {
    const { data, isLoading } = useQuery({
        queryKey: ["campaign", "hasActive", ...addresses],
        queryFn: async () => {
            // Fetch a few generic onchain information
            const isActives = await multicall(viemClient, {
                contracts: addresses.map(
                    (address) =>
                        ({
                            abi: interactionCampaignAbi,
                            address,
                            functionName: "isActive",
                            args: [],
                        }) as const
                ),
                allowFailure: false,
            });

            return isActives.some((isActive) => isActive);
        },
    });

    return {
        hasActiveCampaigns: data,
        isLoading,
    };
}
