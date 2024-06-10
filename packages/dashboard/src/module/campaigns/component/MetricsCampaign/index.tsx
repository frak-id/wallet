"use client";

import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { FormObjectives } from "@/module/campaigns/component/MetricsCampaign/FormObjectives";
import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import { useSetAtom } from "jotai";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export type FormCampaignsMetrics = {
    clicFrom: number;
    clicTo: number;
    registrationFrom: number;
    registrationTo: number;
    purchaseFrom: number;
    purchaseTo: number;
};

export function MetricsCampaign() {
    const router = useRouter();
    const setStep = useSetAtom(campaignStepAtom);

    const form = useForm<FormCampaignsMetrics>({
        defaultValues: {
            clicFrom: 0,
            clicTo: 0,
            registrationFrom: 0,
            registrationTo: 0,
            purchaseFrom: 0,
            purchaseTo: 0,
        },
    });

    function onSubmit(values: FormCampaignsMetrics) {
        console.log(values);
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
