"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { FormBudget } from "@/module/campaigns/component/Creation/NewCampaign/FormBudget";
import { FormSchedule } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
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

    const form = useForm<Campaign>({
        values: useMemo(() => campaign, [campaign]),
    });

    async function onSubmit(values: Campaign) {
        console.log(values);
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
                            <Button type={"submit"} variant={"submit"}>
                                Publish
                            </Button>
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
