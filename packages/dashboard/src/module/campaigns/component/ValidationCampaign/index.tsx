"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { FormCheck } from "@/module/campaigns/component/ValidationCampaign/FormCheck";
import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useAtom, useSetAtom } from "jotai";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function ValidationCampaign() {
    const router = useRouter();
    const setStep = useSetAtom(campaignStepAtom);
    const [campaign, setCampaign] = useAtom(campaignAtom);

    const form = useForm<Campaign>({
        defaultValues: campaign,
    });

    function onSubmit(values: Campaign) {
        console.log(values);
        setCampaign(values);
        // TODO send data to the server
        setStep((prev) => prev + 1);
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
