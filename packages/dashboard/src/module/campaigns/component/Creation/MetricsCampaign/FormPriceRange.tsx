import { FormFromTo } from "@/module/campaigns/component/Creation/MetricsCampaign/FormFromTo";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import { interactionTypesLabel } from "@/module/product/utils/interactionTypes";
import type { Campaign } from "@/types/Campaign";
import {
    type InteractionTypesKey,
    type ProductTypesKey,
    interactionTypes,
} from "@frak-labs/nexus-sdk/core";
import type { UseFormReturn } from "react-hook-form";

export function FormPriceRange({
    form,
    productTypes,
}: {
    form: UseFormReturn<Campaign["rewards"]>;
    productTypes: ProductTypesKey[];
}) {
    return (
        <Panel title="Configure Price Range">
            <FormDescription>
                Set a price range for each campaign objective. The budget will
                be distributed between the referee and referrer according to an
                automatically optimized allocation key. Frak will apply a 20%
                management fee to support the campaign delivery and to cover
                operational costs.
            </FormDescription>
            {productTypes
                .filter((productType) => productType !== "dapp")
                .map((productType) => (
                    <div key={productType}>
                        {Object.keys(interactionTypes[productType]).map(
                            (key) => (
                                <FormFromTo
                                    key={key}
                                    id={key}
                                    label={
                                        interactionTypesLabel[
                                            key as InteractionTypesKey
                                        ].name
                                    }
                                    form={form}
                                    from={{
                                        name: `${key as InteractionTypesKey}.from`,
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
                                        name: `${key as InteractionTypesKey}.to`,
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
                            )
                        )}
                    </div>
                ))}
        </Panel>
    );
}
