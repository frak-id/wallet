import { FormFromTo } from "@/module/campaigns/component/Creation/MetricsCampaign/FormFromTo";
import { FormDescription, FormItem } from "@/module/forms/Form";
import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import type { Campaign } from "@/types/Campaign";
import type { InteractionTypesKey } from "@frak-labs/core-sdk";
import type { UseFormReturn } from "react-hook-form";

export function FormPriceRange({
    form,
    disabled,
}: {
    form: UseFormReturn<Campaign>;
    disabled?: boolean;
}) {
    const triggers = form.getValues("triggers");
    return (
        <FormItem>
            <FormDescription label={"Price Range"} />
            {triggers &&
                Object.keys(triggers).map((trigger) => (
                    <FormFromTo
                        key={trigger}
                        id={trigger}
                        label={
                            interactionTypesInfo[trigger as InteractionTypesKey]
                                .name
                        }
                        form={form}
                        from={{
                            name: `triggers.${trigger as InteractionTypesKey}.from`,
                            label: "From",
                            placeholder: "25,00 €",
                            rightSection: "EUR",
                        }}
                        to={{
                            name: `triggers.${trigger as InteractionTypesKey}.to`,
                            label: "To",
                            placeholder: "25,00 €",
                            rightSection: "EUR",
                        }}
                        hideIfAllZero={true}
                        disabled={disabled}
                    />
                ))}
        </FormItem>
    );
}
