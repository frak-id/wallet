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
import { mapCampaignToFormData } from "@/module/campaigns/utils/mapper";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { LinkButton } from "@/module/common/component/LinkButton";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export function CampaignDetails({
    campaignId,
    campaign: preloadedCampaign,
}: {
    campaignId: string;
    campaign?: Campaign;
}) {
    const merchantId = preloadedCampaign?.merchantId ?? "";

    const {
        data: campaign = preloadedCampaign,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["campaign", campaignId],
        queryFn: () => getCampaignDetail({ data: { campaignId, merchantId } }),
        enabled: !preloadedCampaign && !!merchantId,
        initialData: preloadedCampaign,
    });
    const campaignState = campaignStore((state) => state.campaign);

    const form = useForm<CampaignFormValues>({
        defaultValues: campaignState,
    });

    useEffect(() => {
        if (!campaign) return;
        const formValues = mapCampaignToFormData(campaign);
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
            <CampaignStatus campaign={campaign} />
            <Panel title={"Campaign Details"}>
                <Form {...form}>
                    <FormAdvertising {...form} />
                    <FormGoal {...form} />
                    <FormBudgetRow disabled={true} />
                    <CampaignTerritory campaign={campaign} />
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
