import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { FormCheck } from "@/module/campaigns/component/Creation/ValidationCampaign/FormCheck";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useStatusTransition } from "@/module/campaigns/hook/useStatusTransition";
import { mapCampaignFormToInput } from "@/module/campaigns/utils/mapper";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import styles from "./index.module.css";

export function ValidationCampaign() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isDemoMode = useIsDemoMode();

    const campaign = campaignStore((state) => state.campaign);
    const campaignSuccess = campaignStore((state) => state.success);
    const isClosing = campaignStore((state) => state.isClosing);
    const setSuccess = campaignStore((state) => state.setSuccess);
    const reset = campaignStore((state) => state.reset);

    const saveCampaign = useSaveCampaign();
    const { mutateAsync: publishCampaign } = useStatusTransition();

    const form = useForm<CampaignFormValues>({
        values: useMemo(() => campaign, [campaign]),
    });

    const { mutate: saveAndPublish, isPending } = useMutation({
        mutationKey: ["campaign", "save-publish"],
        mutationFn: async (values: CampaignFormValues) => {
            if (isDemoMode) {
                await new Promise((r) => setTimeout(r, 1000));
                return;
            }

            const input = mapCampaignFormToInput(values);
            const saved = await saveCampaign.mutateAsync({
                ...input,
                campaignId: campaign.id,
            });

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

    function handleSubmit(values: CampaignFormValues) {
        if (campaignSuccess) {
            reset();
            navigate({ to: "/campaigns/list" });
            return;
        }

        if (isClosing) {
            const input = mapCampaignFormToInput(values);
            saveCampaign.mutate({ ...input, campaignId: campaign.id });
            return;
        }

        saveAndPublish(values);
    }

    const isLoading = isPending || saveCampaign.isPending;

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Validation", size: "small" }}
                rightSection={
                    <ButtonCancel
                        onClick={() => form.reset(campaign)}
                        disabled={campaignSuccess || isLoading}
                    />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    {!campaignSuccess && <FormCheck {...form} />}
                    {campaignSuccess && <SuccessMessage />}
                    <Actions isLoading={isLoading} />
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
