"use client";

import {
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import { FormCheck } from "@/module/campaigns/component/ValidationCampaign/FormCheck";
import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import { useSetAtom } from "jotai";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export type FormCampaignsValidation = {
    title: string;
    order: string;
    goal: string;
    advertising: string[];
    budget: string;
    budgetAmount: number;
    registrationFrom: number;
    registrationTo: number;
    purchaseFrom: number;
    purchaseTo: number;
    promotedContent: string[];
};

export function ValidationCampaign() {
    const router = useRouter();
    const setStep = useSetAtom(campaignStepAtom);
    const setSuccess = useSetAtom(campaignSuccessAtom);

    const form = useForm<FormCampaignsValidation>({
        defaultValues: {
            title: "My new campaign",
            order: "Auction",
            goal: "Awareness",
            advertising: [],
            budget: "daily",
            budgetAmount: 100,
            registrationFrom: 1.2,
            registrationTo: 4.2,
            purchaseFrom: 2,
            purchaseTo: 8,
            promotedContent: [],
        },
    });

    function onSubmit(values: FormCampaignsValidation) {
        console.log(values);
        setSuccess(true);
        setStep(1);
    }

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Validation", size: "small" }}
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
                    <FormCheck {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
