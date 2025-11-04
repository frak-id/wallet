import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { FormBank } from "@/module/campaigns/component/Creation/NewCampaign/FormBank";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormGoals } from "@/module/campaigns/component/Creation/NewCampaign/FormGoals";
import { FormProduct } from "@/module/campaigns/component/Creation/NewCampaign/FormProduct";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { FormSpecialAdvertising } from "@/module/campaigns/component/Creation/NewCampaign/FormSpecialAdvertising";
import { FormTerritory } from "@/module/campaigns/component/Creation/NewCampaign/FormTerritory";
import { FormTitle } from "@/module/campaigns/component/Creation/NewCampaign/FormTitle";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

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

    const form = useForm<Campaign>({
        values: useMemo(() => campaign, [campaign]),
    });

    /**
     * Populate the form with campaign atom
     */
    useEffect(() => {
        form.reset(campaign);
    }, [campaign, form.reset, form]);

    async function onSubmit(values: Campaign) {
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
                    <FormProduct />
                    <FormBank />
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
