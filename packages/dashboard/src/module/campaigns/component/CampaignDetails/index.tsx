"use client";

import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { ActionsWrapper } from "@/module/campaigns/component/Actions";
import { CampaignPromotedContent } from "@/module/campaigns/component/CampaignDetails/CampaignPromotedContent";
import { CampaignStatus } from "@/module/campaigns/component/CampaignDetails/CampaignStatus";
import { CampaignTerritory } from "@/module/campaigns/component/CampaignDetails/CampaignTerritory";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { FormObjectives } from "@/module/campaigns/component/Creation/ValidationCampaign/FormObjectives";
import { FormOrder } from "@/module/campaigns/component/Creation/ValidationCampaign/FormOrder";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Button } from "@module/component/Button";
import { Skeleton } from "@module/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

/**
 * Campaign details component
 * @param campaignId
 * @constructor
 */
export function CampaignDetails({
    campaignId,
}: {
    campaignId: string;
}) {
    const router = useRouter();
    const {
        data: campaign,
        isLoading,
        isPending,
    } = useQuery({
        queryKey: ["campaign", campaignId],
        queryFn: () => getCampaignDetails({ campaignId }),
    });
    const campaignState = useAtomValue(campaignAtom);

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
                    <FormOrder {...form} />
                    <FormGoal {...form} />
                    <FormBudgetRow
                        {...form}
                        isCheckCampaign={true}
                        disabled={true}
                    />
                    <CampaignTerritory campaign={campaign} />
                    <FormObjectives {...form} disabled={true} />
                    <CampaignPromotedContent campaign={campaign} />
                </Form>
            </Panel>
            <ActionsWrapper
                right={
                    <Button
                        variant={"submit"}
                        onClick={() => router.push("/campaigns/list")}
                    >
                        Close
                    </Button>
                }
            />
        </FormLayout>
    );
}
