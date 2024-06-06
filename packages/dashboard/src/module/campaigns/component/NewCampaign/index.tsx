"use client";

import { FormBudget } from "@/module/campaigns/component/NewCampaign/FormBudget";
import { FormGoals } from "@/module/campaigns/component/NewCampaign/FormGoals";
import { FormSchedule } from "@/module/campaigns/component/NewCampaign/FormSchedule";
import { FormSpecialAdvertising } from "@/module/campaigns/component/NewCampaign/FormSpecialAdvertising";
import { FormTerritory } from "@/module/campaigns/component/NewCampaign/FormTerritory";
import { FormTitle } from "@/module/campaigns/component/NewCampaign/FormTitle";
import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export type FormCampaignsNew = {
    title: string;
    order: string;
    goal: string;
    advertising: string[];
    budget: string;
    budgetAmount: number;
    territory: string[];
    dateStart: Date;
    dateEnd: Date;
};

export function NewCampaign() {
    const router = useRouter();

    const form = useForm<FormCampaignsNew>({
        defaultValues: {
            title: "",
            order: "",
            goal: "",
            advertising: [],
            budget: "",
            budgetAmount: 0,
            territory: [],
            dateStart: new Date(),
            dateEnd: new Date(),
        },
    });

    function onSubmit(values: FormCampaignsNew) {
        console.log(values);
    }

    return (
        <FormLayout>
            <Head
                title={{ content: "Create a new campaign", size: "small" }}
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
                    <FormTitle {...form} />
                    <FormGoals {...form} />
                    <FormSpecialAdvertising {...form} />
                    <FormBudget {...form} />
                    <FormTerritory {...form} />
                    <FormSchedule {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
