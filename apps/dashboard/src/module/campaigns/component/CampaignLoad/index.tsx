"use client";

import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { type PropsWithChildren, useEffect } from "react";
import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

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
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setAction = campaignStore((state) => state.setAction);
    const isFetched = campaignStore((state) => state.isFetched);
    const setIsFetched = campaignStore((state) => state.setIsFetched);
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
        setAction(campaignAction);

        // Redirect in case of draft page and campaign is created
        if (campaignAction === "edit" && isDraftPage) {
            router.push(`/campaigns/edit/${campaignId}`);
        }

        // Redirect in case of edit page and campaign is draft
        if (campaignAction === "draft" && isEditPage) {
            router.push(`/campaigns/draft/${campaignId}`);
        }
    }, [setAction, campaign, pathname, router, campaignId]);

    useEffect(() => {
        if (!isFetched && campaign) {
            setCampaign({ ...campaign, id: campaignId } as Campaign);
            setIsFetched(true);
        }
    }, [isFetched, setIsFetched, campaign, setCampaign, campaignId]);

    if (isLoading || isPending) {
        return <Spinner />;
    }

    if (!campaign) {
        return <p>Campaign not found</p>;
    }

    return children;
}
