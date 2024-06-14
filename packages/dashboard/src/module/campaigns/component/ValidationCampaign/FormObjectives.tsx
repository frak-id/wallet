import { FormFromTo } from "@/module/campaigns/component/MetricsCampaign/FormFromTo";
import type { FormCampaignsValidation } from "@/module/campaigns/component/ValidationCampaign/index";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { UseFormReturn } from "react-hook-form";

export function FormObjectives(form: UseFormReturn<FormCampaignsValidation>) {
    return (
        <FormItem>
            <FormDescription title={"Objectives"} />
            <FormFromTo
                id={"registration"}
                label={"Registration"}
                form={form}
                from={{
                    name: "registrationFrom",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "registrationTo",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                defaultChecked={true}
            />
            <FormFromTo
                id={"purchase"}
                label={"Purchase"}
                form={form}
                from={{
                    name: "purchaseFrom",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "purchaseTo",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                defaultChecked={true}
            />
        </FormItem>
    );
}
