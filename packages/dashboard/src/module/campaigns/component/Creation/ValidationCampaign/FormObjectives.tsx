import { FormFromTo } from "@/module/campaigns/component/Creation/MetricsCampaign/FormFromTo";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormObjectives(
    form: UseFormReturn<Campaign> & { disabled?: boolean }
) {
    const { disabled } = form;
    return (
        <FormItem>
            <FormDescription title={"Objectives"} />
            <FormFromTo
                id={"click"}
                label={"Click"}
                form={form}
                from={{
                    name: "rewards.click.from",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "rewards.click.to",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                hideIfAllZero={true}
                disabled={disabled}
            />
            <FormFromTo
                id={"registration"}
                label={"Registration"}
                form={form}
                from={{
                    name: "rewards.registration.from",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "rewards.registration.to",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                hideIfAllZero={true}
                disabled={disabled}
            />
            <FormFromTo
                id={"purchase"}
                label={"Purchase"}
                form={form}
                from={{
                    name: "rewards.purchase.from",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "rewards.purchase.to",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                hideIfAllZero={true}
                disabled={disabled}
            />
        </FormItem>
    );
}
