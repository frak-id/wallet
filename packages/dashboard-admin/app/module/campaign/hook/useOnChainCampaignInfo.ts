import {
    interactionCampaignAbi,
    referralCampaignAbi,
} from "@frak-labs/app-essentials";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { multicall } from "viem/actions";
import { viemClient } from "~/module/common/lib/blockchain";

export function useOnChainCampaignInfo(address: Address) {
    const { data, isLoading } = useQuery({
        queryKey: ["campaign", address],
        queryFn: async () => {
            // Fetch a few generic onchain information
            const [metadata, isActive, isRunning, config] = await multicall(
                viemClient,
                {
                    contracts: [
                        {
                            abi: interactionCampaignAbi,
                            address: address,
                            functionName: "getMetadata",
                            args: [],
                        } as const,
                        {
                            abi: interactionCampaignAbi,
                            address: address,
                            functionName: "isActive",
                            args: [],
                        } as const,
                        {
                            abi: interactionCampaignAbi,
                            address: address,
                            functionName: "isRunning",
                            args: [],
                        } as const,
                        {
                            abi: referralCampaignAbi,
                            address: address,
                            functionName: "getConfig",
                            args: [],
                        } as const,
                    ],
                    allowFailure: false,
                }
            );

            return {
                metadata,
                isActive,
                isRunning,
                config,
            };
        },
    });

    return {
        info: data,
        isLoading,
    };
}
