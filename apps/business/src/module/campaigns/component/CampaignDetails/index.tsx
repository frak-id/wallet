import { Button } from "@frak-labs/ui/component/Button";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import { CampaignStatus } from "@/module/campaigns/component/CampaignDetails/CampaignStatus";
import { CampaignTerritory } from "@/module/campaigns/component/CampaignDetails/CampaignTerritory";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { FormPriceRange } from "@/module/campaigns/component/Creation/ValidationCampaign/FormPriceRange";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

/**
 * Campaign details component
 * @param campaignId
 * @param campaign - Optional preloaded campaign data from route loader
 * @constructor
 */
export function CampaignDetails({
    campaignId,
    campaign: preloadedCampaign,
}: {
    campaignId: string;
    campaign?: Campaign;
}) {
    const navigate = useNavigate();
    const {
        data: campaign = preloadedCampaign,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["campaign", campaignId],
        queryFn: () => getCampaignDetails({ data: { campaignId } }),
        enabled: !preloadedCampaign, // Only fetch if not preloaded
        initialData: preloadedCampaign,
    });
    const campaignState = campaignStore((state) => state.campaign);

    const form = useForm<Campaign>({
        defaultValues: campaignState,
    });

    useEffect(() => {
        if (!campaign) return;
        form.reset(campaign);
    }, [campaign, form]);

    if (isLoading || isPending) {
        return <Skeleton />;
    }

    if (!campaign) {
        return <Panel title={"Campaign Status"}>Campaign not found</Panel>;
    }

    return (
        <FormLayout>
            <CampaignStatus campaign={campaign} />
            <Panel title={"Campaign Details"}>
                <Form {...form}>
                    <FormAdvertising {...form} />
                    <FormGoal {...form} />
                    <FormBudgetRow disabled={true} />
                    <CampaignTerritory campaign={campaign} />
                    <FormPriceRange />
                </Form>
            </Panel>
            <ActionsWrapper
                right={
                    <Button
                        variant={"submit"}
                        onClick={() => navigate({ to: "/campaigns/list" })}
                    >
                        Close
                    </Button>
                }
            />
        </FormLayout>
    );
}
