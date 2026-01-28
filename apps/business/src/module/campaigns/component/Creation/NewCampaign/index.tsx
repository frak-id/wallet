import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormGoals } from "@/module/campaigns/component/Creation/NewCampaign/FormGoals";
import { FormMerchant } from "@/module/campaigns/component/Creation/NewCampaign/FormMerchant";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { FormSpecialAdvertising } from "@/module/campaigns/component/Creation/NewCampaign/FormSpecialAdvertising";
import { FormTerritory } from "@/module/campaigns/component/Creation/NewCampaign/FormTerritory";
import { FormTitle } from "@/module/campaigns/component/Creation/NewCampaign/FormTitle";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { mapCampaignFormToInput } from "@/module/campaigns/utils/mapper";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";

export function NewCampaign({ title }: { title: string }) {
    const campaign = campaignStore((state) => state.campaign);
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setStep = campaignStore((state) => state.setStep);
    const campaignSuccess = campaignStore((state) => state.success);
    const reset = campaignStore((state) => state.reset);
    const setIsClosing = campaignStore((state) => state.setIsClosing);
    const saveCampaign = useSaveCampaign();

    useEffect(() => {
        if (campaignSuccess) reset();
        setIsClosing(false);
    }, [campaignSuccess, reset, setIsClosing]);

    const form = useForm<CampaignFormValues>({
        values: useMemo(() => campaign, [campaign]),
    });

    useEffect(() => {
        form.reset(campaign);
    }, [campaign, form]);

    async function onSubmit(values: CampaignFormValues) {
        setCampaign({ ...campaign, ...values });

        await saveCampaign.mutateAsync({
            ...mapCampaignFormToInput(values),
            campaignId: campaign.id,
        });

        setStep((s) => s + 1);
    }

    return (
        <FormLayout>
            <Head
                title={{ content: title, size: "small" }}
                rightSection={
                    <ButtonCancel onClick={() => form.reset(campaign)} />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormTitle {...form} />
                    <FormMerchant />
                    <FormGoals {...form} />
                    <FormSpecialAdvertising {...form} />
                    <FormBudget />
                    <FormTerritory {...form} />
                    <FormSchedule {...form} />
                    <Actions isLoading={saveCampaign.isPending} />
                </form>
            </Form>
        </FormLayout>
    );
}
