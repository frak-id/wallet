import { Button } from "@frak-labs/ui/component/Button";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { getCapPeriod } from "@/context/campaigns/utils/capPeriods";
import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { useEditCampaign } from "@/module/campaigns/hook/useEditCampaign";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign, FinalizedCampaignWithState } from "@/types/Campaign";

/**
 * Campaign edit component
 * @constructor
 */
export function CampaignEdit() {
    const campaign = campaignStore((state) => state.campaign);

    const {
        mutate: onEditCampaign,
        isPending: isEditingCampaign,
        isSuccess: isSuccessCampaign,
    } = useEditCampaign();

    const form = useForm<Campaign>({
        values: useMemo(() => campaign, [campaign]),
    });

    async function onSubmit(values: Campaign) {
        const { budget, state } = values as FinalizedCampaignWithState;

        if (state.key !== "created") return;

        // Compute the cap period
        const capPeriod = getCapPeriod(budget.type);

        onEditCampaign({
            campaign: state.address,
            activationPeriod: {
                start: values.scheduled?.dateStart,
                end: values.scheduled?.dateEnd,
            },
            capConfig: {
                period: capPeriod,
                amount: budget.maxEuroDaily,
            },
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
                        left={isSuccessCampaign && <ActionsMessageSuccess />}
                        right={
                            <Button
                                type={"submit"}
                                variant={"submit"}
                                disabled={isEditingCampaign}
                                isLoading={isEditingCampaign}
                            >
                                Publish
                            </Button>
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
