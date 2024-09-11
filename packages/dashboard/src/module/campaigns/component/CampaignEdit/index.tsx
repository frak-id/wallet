"use client";

import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import {
    campaignActionAtom,
    campaignAtom,
    isFetchedCampaignAtom,
} from "@/module/campaigns/atoms/campaign";
import type { Campaign } from "@/types/Campaign";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { type PropsWithChildren, useEffect } from "react";

/**
 * Campaign edit component
 * @param params
 * @constructor
 */
export function CampaignEdit({
    campaignId,
    children,
}: PropsWithChildren<{
    campaignId: string;
}>) {
    const setCampaign = useSetAtom(campaignAtom);
    const setCampaignAction = useSetAtom(campaignActionAtom);
    const [isFetchedCampaign, setIsFetchedCampaign] = useAtom(
        isFetchedCampaignAtom
    );
    const {
        data: campaign,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["campaign", campaignId],
        queryFn: () => getCampaignDetails({ campaignId }),
    });

    useEffect(() => {
        setCampaignAction("edit");
    }, [setCampaignAction]);

    useEffect(() => {
        if (!isFetchedCampaign && campaign) {
            setCampaign({ ...campaign, id: campaignId } as Campaign);
            setIsFetchedCampaign(true);
        }
    }, [
        isFetchedCampaign,
        setIsFetchedCampaign,
        campaign,
        setCampaign,
        campaignId,
    ]);

    if (isLoading || isPending) {
        return <Spinner />;
    }

    if (!campaign) {
        return <p>Campaign not found</p>;
    }

    return children;
}
