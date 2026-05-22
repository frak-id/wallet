import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormGoals } from "@/module/campaigns/component/Creation/NewCampaign/FormGoals";
import { FormRewardToken } from "@/module/campaigns/component/Creation/NewCampaign/FormRewardToken";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { FormSpecialAdvertising } from "@/module/campaigns/component/Creation/NewCampaign/FormSpecialAdvertising";
import { FormTerritory } from "@/module/campaigns/component/Creation/NewCampaign/FormTerritory";
import { FormTitle } from "@/module/campaigns/component/Creation/NewCampaign/FormTitle";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { Form, FormLayout } from "@/module/forms/Form";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";

export function NewCampaign({ title }: { title: string }) {
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();

    // Persist the URL merchantId into the draft store so subsequent
    // sessions (page reload, navigations) start from the correct value.
    // The effect runs *after* the first commit, so submit handlers below
    // still spread `merchantId` explicitly — guarding against the user
    // submitting (e.g. a fast click on an autofilled form) before the
    // effect has flushed.
    useEffect(() => {
        if (draft.merchantId !== merchantId) {
            updateDraft((d) => ({ ...d, merchantId }));
        }
    }, [draft.merchantId, merchantId, updateDraft]);

    const form = useForm<CampaignDraft>({
        values: useMemo(() => ({ ...draft, merchantId }), [draft, merchantId]),
    });

    async function onSubmit(values: CampaignDraft) {
        const payload = { ...values, merchantId };
        const saved = await saveCampaign.mutateAsync(payload);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/metrics",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(async (values: CampaignDraft) => {
        await saveCampaign.mutateAsync({ ...values, merchantId });
    });

    return (
        <FormLayout>
            <Head
                title={{ content: title, size: "small" }}
                rightSection={
                    <ButtonCancel onClick={() => form.reset(draft)} />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormTitle />
                    <FormRewardToken />
                    <FormGoals />
                    <FormSpecialAdvertising />
                    <FormBudget />
                    <FormTerritory />
                    <FormSchedule />
                    <Actions
                        isLoading={saveCampaign.isPending}
                        onSaveDraft={handleSaveDraft}
                        isSaving={saveCampaign.isPending}
                        isSaved={saveCampaign.isSuccess}
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
