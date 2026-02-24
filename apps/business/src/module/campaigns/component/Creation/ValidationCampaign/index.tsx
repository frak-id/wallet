import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { FormCheck } from "@/module/campaigns/component/Creation/ValidationCampaign/FormCheck";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useStatusTransition } from "@/module/campaigns/hook/useStatusTransition";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import styles from "./index.module.css";

export function ValidationCampaign() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isDemoMode = useIsDemoMode();

    const draft = campaignStore((s) => s.draft);
    const isSuccess = campaignStore((s) => s.isSuccess);
    const setSuccess = campaignStore((s) => s.setSuccess);
    const reset = campaignStore((s) => s.reset);

    const saveCampaign = useSaveCampaign();
    const { mutateAsync: publishCampaign } = useStatusTransition();

    const form = useForm<CampaignDraft>({
        values: useMemo(() => draft, [draft]),
    });

    const { mutate: saveAndPublish, isPending } = useMutation({
        mutationKey: ["campaign", "save-publish"],
        mutationFn: async (values: CampaignDraft) => {
            if (isDemoMode) {
                await new Promise((r) => setTimeout(r, 1000));
                return;
            }

            const saved = await saveCampaign.mutateAsync(values);

            if (!saved?.id) throw new Error("Failed to save campaign");

            await publishCampaign({
                merchantId: values.merchantId,
                campaignId: saved.id,
                action: "publish",
            });
        },
        onSuccess: async () => {
            setSuccess(true);
            await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        },
    });

    function handleSubmit(values: CampaignDraft) {
        if (isSuccess) {
            reset();
            navigate({ to: "/campaigns/list" });
            return;
        }

        saveAndPublish(values);
    }

    const handleSaveDraft = form.handleSubmit(async (values: CampaignDraft) => {
        await saveCampaign.mutateAsync(values);
    });

    const isLoading = isPending || saveCampaign.isPending;

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Validation", size: "small" }}
                rightSection={
                    <ButtonCancel
                        onClick={() => form.reset(draft)}
                        disabled={isSuccess || isLoading}
                    />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    {!isSuccess && <FormCheck />}
                    {isSuccess && <SuccessMessage />}
                    <Actions
                        isLoading={isLoading}
                        onSaveDraft={handleSaveDraft}
                        isSaving={saveCampaign.isPending}
                        isSaved={saveCampaign.isSuccess}
                    />
                </form>
            </Form>
        </FormLayout>
    );
}

function SuccessMessage() {
    return (
        <Panel title="Campaign published">
            <p className={styles.validationCampaign__message}>
                Your campaign was successfully created and published!
            </p>
        </Panel>
    );
}
