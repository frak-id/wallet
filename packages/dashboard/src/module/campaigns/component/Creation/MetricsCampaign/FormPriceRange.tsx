import { FormFromTo } from "@/module/campaigns/component/Creation/MetricsCampaign/FormFromTo";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormPriceRange(form: UseFormReturn<Campaign["rewards"]>) {
    return (
        <Panel title="Configure Price Range">
            <FormDescription>
                Set a price range for each campaign objective. The budget will
                be distributed between the referee and referrer according to an
                automatically optimized allocation key. Frak will apply a 20%
                management fee to support the campaign delivery and to cover
                operational costs.
            </FormDescription>
            <FormFromTo
                id={"click"}
                label={"Click"}
                form={form}
                defaultChecked={true}
                from={{
                    name: "click.from",
                    label: "From",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                    rules: {
                        validate: {
                            required: (value) => value > 0,
                        },
                    },
                }}
                to={{
                    name: "click.to",
                    label: "To",
                    placeholder: "25,00 €",
                    rightSection: "EUR",
                    rules: {
                        validate: {
                            required: (value) => value > 0,
                        },
                    },
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
                disabled={true}
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
                disabled={true}
            />
        </Panel>
    );
}
