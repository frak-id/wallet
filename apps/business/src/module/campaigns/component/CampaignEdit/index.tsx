import { Stack } from "@frak-labs/design-system/components/Stack";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { FormTitle } from "@/module/campaigns/component/Creation/NewCampaign/FormTitle";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { Form, FormLayout } from "@/module/forms/Form";
import {
    type CampaignDraft,
    campaignStore,
    getStartDate,
    setStartDate,
} from "@/stores/campaignStore";

/** The draft plus a flat schedule view that `FormSchedule` binds to. */
type EditFormValues = CampaignDraft & {
    scheduled: { startDate?: string; endDate?: string };
};

export function CampaignEdit({ campaignId }: { campaignId: string }) {
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((state) => state.draft);
    const saveCampaign = useSaveCampaign();

    const formValues = useMemo<EditFormValues>(
        () => ({
            ...draft,
            id: campaignId,
            scheduled: {
                startDate: getStartDate(draft.rule),
                endDate: draft.expiresAt,
            },
        }),
        [draft, campaignId]
    );

    const form = useForm<EditFormValues>({
        values: formValues,
    });

    async function onSubmit(values: EditFormValues) {
        const { scheduled, ...rest } = values;
        await saveCampaign.mutateAsync({
            ...rest,
            rule: setStartDate(rest.rule, scheduled.startDate),
            expiresAt: scheduled.endDate,
        });
        navigate({
            to: "/m/$merchantId/campaigns/list",
            params: { merchantId },
        });
    }

    return (
        <FormLayout>
            <Head title={{ content: "Edit campaign", size: "small" }} />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Stack space="l">
                        <FormTitle />
                        <FormBudget />
                        <FormSchedule />
                        <ActionsWrapper
                            right={
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={saveCampaign.isPending}
                                    loading={saveCampaign.isPending}
                                >
                                    Save Changes
                                </Button>
                            }
                        />
                    </Stack>
                </form>
            </Form>
        </FormLayout>
    );
}
