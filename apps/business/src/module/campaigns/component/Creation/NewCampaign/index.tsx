import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormGoals } from "@/module/campaigns/component/Creation/NewCampaign/FormGoals";
import { FormMerchant } from "@/module/campaigns/component/Creation/NewCampaign/FormMerchant";
import { FormRewardToken } from "@/module/campaigns/component/Creation/NewCampaign/FormRewardToken";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { FormSpecialAdvertising } from "@/module/campaigns/component/Creation/NewCampaign/FormSpecialAdvertising";
import { FormTerritory } from "@/module/campaigns/component/Creation/NewCampaign/FormTerritory";
import { FormTitle } from "@/module/campaigns/component/Creation/NewCampaign/FormTitle";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";

export function NewCampaign({ title }: { title: string }) {
    const navigate = useNavigate();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();

    const form = useForm<CampaignDraft>({
        values: useMemo(() => draft, [draft]),
    });

    async function onSubmit(values: CampaignDraft) {
        updateDraft(() => values);
        const saved = await saveCampaign.mutateAsync(values);
        navigate({
            to: "/campaigns/draft/$campaignId/metrics",
            params: { campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(async (values: CampaignDraft) => {
        updateDraft(() => values);
        await saveCampaign.mutateAsync(values);
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
                    <FormMerchant />
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
