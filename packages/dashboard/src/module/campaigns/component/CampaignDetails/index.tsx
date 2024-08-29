"use client";

import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import { CampaignStatus } from "@/module/campaigns/component/CampaignDetails/CampaignStatus";
import { Panel } from "@/module/common/component/Panel";
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
        return <Panel title={"Campaign Status"}>Campaign not found</Panel>;
    }

    return <CampaignStatus campaign={campaign} />;
}
