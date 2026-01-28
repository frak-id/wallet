import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { getCampaignDetail } from "@/module/campaigns/api/campaignApi";
import { CampaignStatus } from "@/module/campaigns/component/CampaignDetails/CampaignStatus";
import { CampaignTerritory } from "@/module/campaigns/component/CampaignDetails/CampaignTerritory";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { LinkButton } from "@/module/common/component/LinkButton";
import { Panel } from "@/module/common/component/Panel";
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
    const merchantId = preloadedCampaign?.merchantId ?? "";
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
                    <FormAdvertising />
                    <FormGoal />
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
