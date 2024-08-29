"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { Actions } from "@/module/campaigns/component/Actions";
import { FormObjectives } from "@/module/campaigns/component/Creation/MetricsCampaign/FormObjectives";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export function MetricsCampaign() {
    const campaign = useAtomValue(campaignAtom);
    const saveCampaign = useSaveCampaign();

    const form = useForm<Campaign["rewards"]>({
        defaultValues: campaign.rewards,
    });

    /**
     * Populate the form with campaign atom
     */
    useEffect(() => {
        form.reset(campaign.rewards);
    }, [campaign, form.reset]);

    async function onSubmit(values: Campaign["rewards"]) {
        await saveCampaign({ ...campaign, rewards: values });
    }

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Metrics", size: "small" }}
                rightSection={
                    <ButtonCancel
                        onClick={() => form.reset(campaign.rewards)}
                    />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormObjectives {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
