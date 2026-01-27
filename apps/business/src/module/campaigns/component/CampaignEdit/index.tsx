import { Button } from "@frak-labs/ui/component/Button";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";

/**
 * Campaign edit component
 * @constructor
 */
export function CampaignEdit({ campaignId }: { campaignId: string }) {
    const campaign = campaignStore((state) => state.campaign);

    const {
        mutate: onSaveCampaign,
        isPending: isSaving,
        isSuccess,
    } = useSaveCampaign();

    const form = useForm<CampaignFormValues>({
        values: useMemo(() => campaign, [campaign]),
    });

    async function onSubmit(values: CampaignFormValues) {
        if (!values.budget) return;

        onSaveCampaign({
            merchantId: values.merchantId,
            campaignId: campaignId,
            name: values.name,
            rule: {
                trigger: values.trigger,
                // TODO: restore conditions if they were part of the form
                conditions: [],
                rewards: [
                    {
                        type: "token",
                        recipient: values.rewardRecipient,
                        amountType: "fixed",
                        amount: values.rewardAmount,
                        chaining: values.rewardChaining,
                    },
                ],
            },
            metadata: {
                goal: values.goal,
                specialCategories: values.specialCategories,
                territories: values.territories,
            },
            budgetConfig: [values.budget],
            expiresAt: values.scheduled?.dateEnd?.toISOString(),
            priority: values.priority,
        });
    }

    return (
        <FormLayout>
            <Head
                title={{
                    content: "Edit campaign",
                    size: "small",
                }}
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormBudget />
                    <FormSchedule {...form} />
                    <ActionsWrapper
                        left={isSuccess && <ActionsMessageSuccess />}
                        right={
                            <Button
                                type={"submit"}
                                variant={"submit"}
                                disabled={isSaving}
                                isLoading={isSaving}
                            >
                                Save Changes
                            </Button>
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
