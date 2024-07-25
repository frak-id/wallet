"use client";

import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { OnChainCampaignInfo } from "@/module/campaigns/component/CampaignDetails/OnChainCampaignInfo";
import { Skeleton } from "@module/component/Skeleton";
import { useQuery } from "@tanstack/react-query";

/**
 * Campaign details component
 * @param params
 * @constructor
 */
export function CampaignDetails({
    campaignId,
}: {
    campaignId: string;
}) {
    const { data: campaign, isLoading } = useQuery({
        queryKey: ["campaign", campaignId],
        queryFn: () => getCampaignDetails({ campaignId }),
    });

    if (isLoading) {
        return <Skeleton />;
    }

    if (!campaign) {
        return <p>Campaign not found</p>;
    }

    return (
        <>
            <CampaignStateComponent campaign={campaign} />
            <hr />
            {campaign.state.key === "created" && (
                <OnChainCampaignInfo state={campaign.state} />
            )}
        </>
    );
}

/**
 * Display the overall campaign state
 * @param campaign
 * @constructor
 */
function CampaignStateComponent({ campaign }: { campaign: CampaignDocument }) {
    return (
        <>
            Title: {campaign.title}
            <br />
            State: {campaign.state.key}
        </>
    );
}
