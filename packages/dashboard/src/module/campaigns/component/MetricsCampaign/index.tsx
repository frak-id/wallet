"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { FormObjectives } from "@/module/campaigns/component/MetricsCampaign/FormObjectives";
import { ButtonCancel } from "@/module/campaigns/component/NewCampaign/ButtonCancel";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useAtom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export function MetricsCampaign() {
    const setStep = useSetAtom(campaignStepAtom);
    const [campaign, setCampaign] = useAtom(campaignAtom);

    const form = useForm<Campaign["rewards"]>({
        defaultValues: campaign.rewards,
    });

    /**
     * Populate the form with campaign atom
     */
    useEffect(() => {
        form.reset(campaign.rewards);
    }, [campaign, form.reset]);

    function onSubmit(values: Campaign["rewards"]) {
        console.log(values);
        setCampaign({ ...campaign, rewards: values });
        setStep((prev) => prev + 1);
    }

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Metrics", size: "small" }}
                rightSection={<ButtonCancel />}
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
