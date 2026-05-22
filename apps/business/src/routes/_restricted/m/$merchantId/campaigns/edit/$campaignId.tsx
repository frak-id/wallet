import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import { CampaignEdit } from "@/module/campaigns/component/CampaignEdit";
import {
    campaignQueryOptions,
    validateEditCampaign,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { CampaignError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { campaignStore, campaignToDraft } from "@/stores/campaignStore";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/edit/$campaignId"
)({
    loader: ({ params }) => {
        queryClient.prefetchQuery(
            campaignQueryOptions({
                merchantId: params.merchantId,
                campaignId: params.campaignId,
                isDemoMode: isDemoMode(),
                validateState: validateEditCampaign(
                    params.merchantId,
                    params.campaignId
                ),
            })
        );
    },
    component: CampaignsEditPage,
    errorComponent: CampaignError,
});

function CampaignsEditPage() {
    const { merchantId, campaignId } = Route.useParams();
    const isDemo = useIsDemoMode();
    const { data: campaign } = useSuspenseQuery(
        campaignQueryOptions({
            merchantId,
            campaignId,
            isDemoMode: isDemo,
            validateState: validateEditCampaign(merchantId, campaignId),
        })
    );

    const setDraft = campaignStore((state) => state.setDraft);

    useEffect(() => {
        setDraft(campaignToDraft(campaign));
    }, [campaign, setDraft]);

    return <CampaignEdit campaignId={campaignId} />;
}
