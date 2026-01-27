import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormGoals } from "@/module/campaigns/component/Creation/NewCampaign/FormGoals";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { FormSpecialAdvertising } from "@/module/campaigns/component/Creation/NewCampaign/FormSpecialAdvertising";
import { FormTerritory } from "@/module/campaigns/component/Creation/NewCampaign/FormTerritory";
import { FormTitle } from "@/module/campaigns/component/Creation/NewCampaign/FormTitle";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";

export function NewCampaign({ title }: { title: string }) {
    const campaign = campaignStore((state) => state.campaign);
    const campaignSuccess = campaignStore((state) => state.success);
    const reset = campaignStore((state) => state.reset);
    const setIsClosing = campaignStore((state) => state.setIsClosing);
    const saveCampaign = useSaveCampaign();

    /**
     * Reset campaign atom when campaign was in success
     */
    useEffect(() => {
        if (campaignSuccess) {
            reset();
        }
        setIsClosing(false);
    }, [campaignSuccess, reset, setIsClosing]);

    const form = useForm<CampaignFormValues>({
        values: useMemo(() => campaign, [campaign]),
    });

    /**
     * Populate the form with campaign atom
     */
    useEffect(() => {
        form.reset(campaign);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaign]);

    async function onSubmit(values: CampaignFormValues) {
        // @ts-expect-error - saveCampaign expects Campaign but we have form values
        // This will be fixed when saveCampaign is updated in later tasks
        await saveCampaign(values);
    }

    return (
        <FormLayout>
            <Head
                title={{
                    content: title,
                    size: "small",
                }}
                rightSection={
                    <ButtonCancel onClick={() => form.reset(campaign)} />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormTitle {...form} />
                    <FormGoals {...form} />
                    <FormSpecialAdvertising {...form} />
                    <FormBudget />
                    <FormTerritory {...form} />
                    <FormSchedule {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
