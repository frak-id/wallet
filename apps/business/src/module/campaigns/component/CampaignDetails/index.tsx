import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { getCampaignDetail } from "@/module/campaigns/api/campaignApi";
import { BudgetUsage } from "@/module/campaigns/component/CampaignDetails/BudgetUsage";
import { CampaignConditions } from "@/module/campaigns/component/CampaignDetails/CampaignConditions";
import { CampaignRewardToken } from "@/module/campaigns/component/CampaignDetails/CampaignRewardToken";
import { CampaignStatus } from "@/module/campaigns/component/CampaignDetails/CampaignStatus";
import { CampaignTerritory } from "@/module/campaigns/component/CampaignDetails/CampaignTerritory";
import { CampaignParametersSheet } from "@/module/campaigns/component/CampaignParametersSheet";
import { CampaignPerformanceSheet } from "@/module/campaigns/component/CampaignPerformanceSheet";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { FormTrigger } from "@/module/campaigns/component/Creation/ValidationCampaign/FormTrigger";
import { RewardsSummary } from "@/module/campaigns/component/RewardsSummary";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { Form, FormLayout } from "@/module/forms/Form";
import {
    type CampaignDraft,
    campaignStore,
    campaignToDraft,
} from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export function CampaignDetails({
    campaignId,
    campaign: preloadedCampaign,
}: {
    campaignId: string;
    campaign?: Campaign;
}) {
    // Active merchant from the URL — equal to the campaign's merchantId
    // under the `/m/$merchantId/campaigns/$campaignId` layout guard, but
    // we trust the URL so navigation away always returns the user to the
    // section they were viewing.
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();

    const {
        data: campaign = preloadedCampaign,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["campaign", campaignId, isDemoMode ? "demo" : "live"],
        queryFn: () =>
            getCampaignDetail({ campaignId, merchantId, isDemoMode }),
        enabled: !preloadedCampaign && !!merchantId,
        initialData: preloadedCampaign,
    });

    const draft = campaignStore((state) => state.draft);
    const setDraft = campaignStore((state) => state.setDraft);

    const formValues = useMemo(() => {
        if (campaign) {
            return campaignToDraft(campaign);
        }
        return draft;
    }, [campaign, draft]);

    const form = useForm<CampaignDraft>({
        values: formValues,
    });

    useEffect(() => {
        if (!campaign) return;
        setDraft(campaignToDraft(campaign));
    }, [campaign, setDraft]);

    if (isLoading || isPending) {
        return <Skeleton variant="rect" height={250} />;
    }

    if (!campaign) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Campaign Status</CardTitle>
                </CardHeader>
                Campaign not found
            </Card>
        );
    }

    const rewards = campaign.rule.rewards ?? [];

    return (
        <FormLayout>
            <CampaignStatus campaign={campaign} />
            <Card>
                <CardHeader>
                    <CardTitle>Campaign Details</CardTitle>
                </CardHeader>
                <Form {...form}>
                    <FormAdvertising />
                    <FormGoal />
                    <FormTrigger />
                    <CampaignConditions conditions={campaign.rule.conditions} />
                    <RewardsSummary rewards={rewards} />
                    <CampaignRewardToken campaign={campaign} />
                    <FormBudgetRow disabled={true} />
                    <BudgetUsage campaign={campaign} />
                    <CampaignTerritory campaign={campaign} />
                </Form>
            </Card>
            <ActionsWrapper
                right={
                    <>
                        <CampaignPerformanceSheet
                            campaign={campaign}
                            campaignId={campaignId}
                        />
                        <CampaignParametersSheet
                            campaign={campaign}
                            campaignId={campaignId}
                        />
                        <LinkButton
                            to="/m/$merchantId/campaigns/list"
                            params={{ merchantId }}
                            variant="primary"
                        >
                            Close
                        </LinkButton>
                    </>
                }
            />
        </FormLayout>
    );
}
