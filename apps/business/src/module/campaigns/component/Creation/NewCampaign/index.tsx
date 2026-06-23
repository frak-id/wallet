import { Stack } from "@frak-labs/design-system/components/Stack";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { FormMerchant } from "@/module/campaigns/component/Creation/NewCampaign/FormMerchant";
import { FormRewardCurrency } from "@/module/campaigns/component/Creation/NewCampaign/FormRewardCurrency";
import { FormTitle } from "@/module/campaigns/component/Creation/NewCampaign/FormTitle";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { Form } from "@/module/forms/Form";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import { WizardStep } from "../WizardStep";

/** Links the sticky-footer Continue button to the form it submits. */
const FORM_ID = "campaign-basics-form";

export function NewCampaign() {
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
        mode: "onChange",
    });

    async function onSubmit(values: CampaignDraft) {
        const payload = { ...values, merchantId };
        const saved = await saveCampaign.mutateAsync(payload);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/goals",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(async (values: CampaignDraft) => {
        await saveCampaign.mutateAsync({ ...values, merchantId });
    });

    return (
        <WizardStep
            stepKey="basics"
            formId={FORM_ID}
            isValid={form.formState.isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={handleSaveDraft}
            onClose={() => form.reset(draft)}
        >
            <Form {...form}>
                <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                    <Stack space="l">
                        <FormTitle />
                        <FormMerchant merchantId={merchantId} />
                        <FormRewardCurrency />
                    </Stack>
                </form>
            </Form>
        </WizardStep>
    );
}
