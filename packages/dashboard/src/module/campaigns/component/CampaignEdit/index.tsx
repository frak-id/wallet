"use client";

import { getCapPeriod } from "@/context/campaigns/utils/capPeriods";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { useEditCampaign } from "@/module/campaigns/hook/useEditCampaign";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Button } from "@module/component/Button";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

/**
 * Campaign edit component
 * @constructor
 */
export function CampaignEdit() {
    const campaign = useAtomValue(campaignAtom);

    const { mutate: onEditCampaign, isPending: isEditingCampaign } =
        useEditCampaign();

    const form = useForm<Campaign>({
        values: useMemo(() => campaign, [campaign]),
    });

    async function onSubmit(values: Campaign) {
        console.log(values);
        const { budget } = values;

        // Compute the cap period
        const capPeriod = getCapPeriod(budget.type);

        onEditCampaign({
            campaign: "", // todo,
            activationPeriod: {
                start: values.scheduled.dateStart,
                end: values.scheduled.dateEnd,
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
                    <FormBudget {...form} />
                    <FormSchedule {...form} />
                    <ActionsWrapper
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
