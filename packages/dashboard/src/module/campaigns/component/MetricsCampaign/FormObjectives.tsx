import { FormFromTo } from "@/module/campaigns/component/MetricsCampaign/FormFromTo";
import type { FormCampaignsMetrics } from "@/module/campaigns/component/MetricsCampaign/index";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import type { UseFormReturn } from "react-hook-form";

// const rules = {
//     required: "Select an amount",
//     validate: (value: number) => value > 0,
// };

export function FormObjectives(form: UseFormReturn<FormCampaignsMetrics>) {
    return (
        <Panel title="Enter your objectives">
            <FormDescription>
                Declare whether your ads concern credit, employment, housing or
                a social, electoral or political issue. Criteria differ from
                country to country.
            </FormDescription>
            <FormFromTo
                id={"clic"}
                label={"Clic"}
                form={form}
                from={{
                    name: "clicFrom",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                    // rules,
                }}
                to={{
                    name: "clicTo",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                    // rules,
                }}
            />
            <FormFromTo
                id={"registration"}
                label={"Registration"}
                form={form}
                from={{
                    name: "registrationFrom",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                    // rules,
                }}
                to={{
                    name: "registrationTo",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                    // rules,
                }}
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
                    // rules,
                }}
                to={{
                    name: "purchaseTo",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                    // rules,
                }}
            />
        </Panel>
    );
}
