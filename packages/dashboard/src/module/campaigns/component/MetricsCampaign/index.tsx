"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { FormObjectives } from "@/module/campaigns/component/MetricsCampaign/FormObjectives";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Button } from "@module/component/Button";
import { useAtom, useSetAtom } from "jotai";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function MetricsCampaign() {
    const router = useRouter();
    const setStep = useSetAtom(campaignStepAtom);
    const [campaign, setCampaign] = useAtom(campaignAtom);

    const form = useForm<Campaign["rewards"]>({
        defaultValues: campaign.rewards,
    });

    function onSubmit(values: Campaign["rewards"]) {
        console.log(values);
        setCampaign({ ...campaign, rewards: values });
        setStep((prev) => prev + 1);
    }

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Metrics", size: "small" }}
                rightSection={
                    <Button
                        variant={"outline"}
                        leftIcon={<X size={20} />}
                        onClick={() => router.push("/campaigns")}
                    >
                        Cancel
                    </Button>
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormObjectives {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
