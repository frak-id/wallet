"use client";

import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import {
    campaignActionAtom,
    campaignAtom,
    isFetchedCampaignAtom,
} from "@/module/campaigns/atoms/campaign";
import type { Campaign } from "@/types/Campaign";
import { Spinner } from "@shared/module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";
import { type PropsWithChildren, useEffect } from "react";

/**
 * Campaign load component
 * @param params
 * @constructor
 */
export function CampaignLoad({
    campaignId,
    children,
}: PropsWithChildren<{
    campaignId: string;
}>) {
    const router = useRouter();
    const pathname = usePathname();
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
        if (!campaign) return;

        const isDraftPage = pathname.includes("/campaigns/draft/");
        const isEditPage = pathname.includes("/campaigns/edit/");
        const campaignAction =
            campaign.state.key === "created" ? "edit" : "draft";

        // Set the campaign action
        setCampaignAction(campaignAction);

        // Redirect in case of draft page and campaign is created
        if (campaignAction === "edit" && isDraftPage) {
            router.push(`/campaigns/edit/${campaignId}`);
        }

        // Redirect in case of edit page and campaign is draft
        if (campaignAction === "draft" && isEditPage) {
            router.push(`/campaigns/draft/${campaignId}`);
        }
    }, [setCampaignAction, campaign, pathname, router, campaignId]);

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
