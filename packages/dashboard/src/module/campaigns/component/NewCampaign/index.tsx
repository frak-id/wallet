"use client";

import {
    campaignAtom,
    campaignResetAtom,
} from "@/module/campaigns/atoms/campaign";
import {
    campaignIsClosingAtom,
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
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export function NewCampaign() {
    const campaignSuccess = useAtomValue(campaignSuccessAtom);
    const campaign = useAtomValue(campaignAtom);
    const campaignReset = useSetAtom(campaignResetAtom);
    const setCampaignIsClosing = useSetAtom(campaignIsClosingAtom);
    const saveCampaign = useSaveCampaign();

    /**
     * Reset campaign atom when campaign was in success
     */
    useEffect(() => {
        if (campaignSuccess) {
            campaignReset();
        }
        setCampaignIsClosing(false);
    }, [campaignSuccess, campaignReset, setCampaignIsClosing]);

    const form = useForm<Campaign>({
        defaultValues: campaign,
    });

    /**
     * Populate the form with campaign atom
     */
    useEffect(() => {
        form.reset(campaign);
    }, [campaign, form.reset]);

    async function onSubmit(values: Campaign) {
        await saveCampaign(values);
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
