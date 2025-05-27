import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

export function useGetOnChainCampaignDetails({
    campaignAddress,
}: { campaignAddress: Address }) {
    return useQuery({
        queryKey: ["campaign", "on-chain-details", campaignAddress],
        queryFn: () => getOnChainCampaignsDetails({ campaignAddress }),
    });
}
