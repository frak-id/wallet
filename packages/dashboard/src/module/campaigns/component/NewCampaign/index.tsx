"use client";

import {
    campaignAtom,
    campaignResetAtom,
} from "@/module/campaigns/atoms/campaign";
import {
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import { ButtonCancel } from "@/module/campaigns/component/NewCampaign/ButtonCancel";
import { FormBudget } from "@/module/campaigns/component/NewCampaign/FormBudget";
import { FormGoals } from "@/module/campaigns/component/NewCampaign/FormGoals";
import { FormProduct } from "@/module/campaigns/component/NewCampaign/FormProduct";
import { FormSchedule } from "@/module/campaigns/component/NewCampaign/FormSchedule";
import { FormSpecialAdvertising } from "@/module/campaigns/component/NewCampaign/FormSpecialAdvertising";
import { FormTerritory } from "@/module/campaigns/component/NewCampaign/FormTerritory";
import { FormTitle } from "@/module/campaigns/component/NewCampaign/FormTitle";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export function NewCampaign() {
    const setStep = useSetAtom(campaignStepAtom);
    const campaignSuccess = useAtomValue(campaignSuccessAtom);
    const [campaign, setCampaign] = useAtom(campaignAtom);
    const campaignReset = useSetAtom(campaignResetAtom);

    /**
     * Reset campaign atom when campaign was in success
     */
    useEffect(() => {
        if (campaignSuccess) {
            campaignReset();
        }
    }, [campaignSuccess, campaignReset]);

    const form = useForm<Campaign>({
        defaultValues: campaign,
    });

    function onSubmit(values: Campaign) {
        console.log(values);
        setCampaign(values);
        setStep((prev) => prev + 1);
    }

    return (
        <FormLayout>
            <Head
                title={{ content: "Create a new campaign", size: "small" }}
                rightSection={
                    <ButtonCancel onClick={() => form.reset(campaign)} />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormTitle {...form} />
                    <FormProduct {...form} />
                    <FormGoals {...form} />
                    <FormSpecialAdvertising {...form} />
                    <FormBudget {...form} />
                    <FormTerritory {...form} />
                    <FormSchedule {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
