import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
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
    const navigate = useNavigate();
    const matchRoute = useMatchRoute();
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
        queryFn: async () => {
            const result = await getCampaignDetails({
                data: { campaignId },
            });
            return result;
        },
    });

    useEffect(() => {
        if (!campaign) return;

        const isDraftPage = matchRoute({
            to: "/campaigns/draft/$campaignId",
            fuzzy: true,
        });
        const isEditPage = matchRoute({
            to: "/campaigns/edit/$campaignId",
            fuzzy: true,
        });
        const campaignAction =
            campaign.state.key === "created" ? "edit" : "draft";

        // Set the campaign action
        setAction(campaignAction);

        // Redirect in case of draft page and campaign is created
        if (campaignAction === "edit" && isDraftPage) {
            navigate({
                to: "/campaigns/edit/$campaignId",
                params: { campaignId },
            });
        }

        // Redirect in case of edit page and campaign is draft
        if (campaignAction === "draft" && isEditPage) {
            navigate({
                to: "/campaigns/draft/$campaignId",
                params: { campaignId },
            });
        }
    }, [setAction, campaign, matchRoute, navigate, campaignId]);

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
