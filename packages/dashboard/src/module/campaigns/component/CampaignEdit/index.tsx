"use client";

import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import type { Campaign } from "@/types/Campaign";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import type { PropsWithChildren } from "react";

/**
 * Campaign edit component
 * @param params
 * @constructor
 */
export function CampaignEdit({
    campaignId,
    children,
}: PropsWithChildren<{ campaignId: string }>) {
    const setCampaign = useSetAtom(campaignAtom);
    const {
        data: campaign,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["campaign", campaignId],
        queryFn: () => getCampaignDetails({ campaignId }),
    });

    useEffect(() => {
        if (campaign) {
            setCampaign({ ...campaign, id: campaignId } as Campaign);
        }
    }, [campaign, setCampaign, campaignId]);

    if (isLoading || isPending) {
        return <Spinner />;
    }

    if (!campaign) {
        return <p>Campaign not found</p>;
    }

    return children;
}
