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
    const campaign = campaignStore((state) => state.campaign);

    const setSuccess = campaignStore((state) => state.setSuccess);
    const campaignSuccess = campaignStore((state) => state.success);
    const isClosing = campaignStore((state) => state.isClosing);
    const save = useSaveCampaign();
    const { mutateAsync: publishStatus } = useStatusTransition();
    const isDemoMode = useIsDemoMode();
    const saveCampaign = useSaveCampaign();

    const form = useForm<CampaignFormValues>({
        values: useMemo(() => campaign, [campaign]),
    });

    const { mutate: createAndPublish, isPending: isPendingPublish } =
        useMutation({
            mutationKey: ["campaign", "create-publish"],
            mutationFn: async (values: CampaignFormValues) => {
                if (isDemoMode) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    setSuccess(true);
                    return;
                }

                const input = mapCampaignFormToInput(values);

                const resultCampaign = await saveCampaign.mutateAsync({
                    campaignId: campaign.id,
                    ...input,
                });

                if (!resultCampaign?.id)
                    throw new Error("Failed to create/update campaign");

                await publishStatus({
                    merchantId: values.merchantId,
                    campaignId: resultCampaign.id,
                    action: "publish",
                });

                setSuccess(true);

                await queryClient.invalidateQueries({
                    queryKey: ["campaigns"],
                });
            },
        });

    const handleSubmit = async (values: CampaignFormValues) => {
        if (campaignSuccess) {
            navigate({ to: "/campaigns/list" });
            return;
        }

        if (isClosing) {
            const input = mapCampaignFormToInput(values);
            save.mutate({ ...input, campaignId: campaign.id });
            return;
        }

        createAndPublish(values);
    };

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Validation", size: "small" }}
                rightSection={
                    <ButtonCancel
                        onClick={() => form.reset(campaign)}
                        disabled={
                            campaignSuccess ||
                            isPendingPublish ||
                            save.isPending
                        }
                    />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    {!campaignSuccess && <FormCheck {...form} />}

                    <CampaignSuccessInfo isCreated={campaignSuccess} />

                    <Actions isLoading={isPendingPublish || save.isPending} />
                </form>
            </Form>
        </FormLayout>
    );
}

function CampaignSuccessInfo({ isCreated }: { isCreated: boolean }) {
    if (!isCreated) return null;

    return (
        <Panel title="Campaign published">
            <p className={styles.validationCampaign__message}>
                Your campaign was successfully created and published!
            </p>
        </Panel>
    );
}
