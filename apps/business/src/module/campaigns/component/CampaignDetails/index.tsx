import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { getCampaignDetail } from "@/context/campaigns/action/getDetails";
import { CampaignStatus } from "@/module/campaigns/component/CampaignDetails/CampaignStatus";
import { CampaignTerritory } from "@/module/campaigns/component/CampaignDetails/CampaignTerritory";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { LinkButton } from "@/module/common/component/LinkButton";
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
    const {
        data: campaign = preloadedCampaign,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["campaign", campaignId],
        queryFn: () =>
            getCampaignDetail({ data: { campaignId, merchantId: "" } }),
        enabled: !preloadedCampaign, // Only fetch if not preloaded
        initialData: preloadedCampaign,
    });
    const campaignState = campaignStore((state) => state.campaign);

    const form = useForm<CampaignFormValues>({
        defaultValues: campaignState,
    });

    useEffect(() => {
        if (!campaign) return;

        // Map Campaign to CampaignFormValues
        const formValues: CampaignFormValues = {
            name: campaign.name,
            merchantId: campaign.merchantId,
            goal: campaign.metadata?.goal,
            specialCategories: campaign.metadata?.specialCategories || [],
            territories: campaign.metadata?.territories || [],
            budget: campaign.budgetConfig?.[0], // Assuming single budget item
            scheduled: {
                // biome-ignore lint/suspicious/noExplicitAny: Backend data might be loose
                dateStart: (campaign as any).scheduled?.dateStart
                    ? new Date((campaign as any).scheduled.dateStart)
                    : new Date(campaign.createdAt),
                // biome-ignore lint/suspicious/noExplicitAny: Backend data might be loose
                dateEnd: campaign.expiresAt
                    ? new Date(campaign.expiresAt)
                    : undefined,
            },
            trigger: campaign.rule.trigger,
            // Assuming first reward is the one we want
            rewardAmount:
                campaign.rule.rewards?.[0]?.type === "token" &&
                campaign.rule.rewards?.[0]?.amountType === "fixed"
                    ? campaign.rule.rewards[0].amount
                    : 0,
            rewardRecipient:
                campaign.rule.rewards?.[0]?.recipient || "referrer",
            priority: campaign.priority,
            rewardChaining: campaign.rule.rewards?.[0]?.chaining,
        };

        form.reset(formValues);
    }, [campaign, form]);

    if (isLoading || isPending) {
        return <Skeleton />;
    }

    if (!campaign) {
        return <Panel title={"Campaign Status"}>Campaign not found</Panel>;
    }

    return (
        <FormLayout>
            <CampaignStatus campaign={campaign as any} />
            <Panel title={"Campaign Details"}>
                <Form {...form}>
                    <FormAdvertising {...form} />
                    <FormGoal {...form} />
                    <FormBudgetRow disabled={true} />
                    <CampaignTerritory campaign={campaign as any} />
                </Form>
            </Panel>
            <ActionsWrapper
                right={
                    <LinkButton to="/campaigns/list" variant="submit">
                        Close
                    </LinkButton>
                }
            />
        </FormLayout>
    );
}
