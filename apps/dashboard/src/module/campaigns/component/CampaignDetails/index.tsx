"use client";

import { getCampaignDetails } from "@/context/campaigns/action/getDetails";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { CampaignStatus } from "@/module/campaigns/component/CampaignDetails/CampaignStatus";
import { CampaignTerritory } from "@/module/campaigns/component/CampaignDetails/CampaignTerritory";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { FormPriceRange } from "@/module/campaigns/component/Creation/ValidationCampaign/FormPriceRange";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Button } from "@frak-labs/ui/component/Button";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
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
                    <FormGoal {...form} />
                    <FormBudgetRow {...form} disabled={true} />
                    <CampaignTerritory campaign={campaign} />
                    <FormPriceRange />
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
