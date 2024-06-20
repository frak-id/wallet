import { FormFromTo } from "@/module/campaigns/component/MetricsCampaign/FormFromTo";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormObjectives(form: UseFormReturn<Campaign["rewards"]>) {
    return (
        <Panel title="Enter your objectives">
            <FormDescription>
                Declare whether your ads concern credit, employment, housing or
                a social, electoral or political issue. Criteria differ from
                country to country.
            </FormDescription>
            <FormFromTo
                id={"click"}
                label={"Click"}
                form={form}
                from={{
                    name: "click.from",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "click.to",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
            />
            <FormFromTo
                id={"registration"}
                label={"Registration"}
                form={form}
                from={{
                    name: "registration.from",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "registration.to",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
            />
            <FormFromTo
                id={"purchase"}
                label={"Purchase"}
                form={form}
                from={{
                    name: "purchase.from",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
                to={{
                    name: "purchase.to",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                }}
            />
        </Panel>
    );
}
