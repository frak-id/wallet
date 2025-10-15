import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";

export function useGetOnChainCampaignDetails({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    return useQuery({
        queryKey: ["campaign", "on-chain-details", campaignAddress],
        queryFn: () => getOnChainCampaignsDetails({ campaignAddress }),
    });
}
