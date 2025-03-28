import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { FormFromTo } from "@/module/campaigns/component/Creation/MetricsCampaign/FormFromTo";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import type { Campaign } from "@/types/Campaign";
import {
    type InteractionTypesKey,
    type ProductTypesKey,
    interactionTypes,
} from "@frak-labs/core-sdk";
import { Button } from "@shared/module/component/Button";
import { useAtomValue, useSetAtom } from "jotai";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

export function FormPriceRange({
    form,
    productTypes = [],
}: {
    form: UseFormReturn<Campaign["triggers"]>;
    productTypes: ProductTypesKey[];
}) {
    const setStep = useSetAtom(campaignStepAtom);
    const { type: currentGoal } = useAtomValue(campaignAtom);
    const availableInteractions = useMemo(() => {
        if (!currentGoal) return [];

        // Iterate over each products types and get the interactions matching
        const possibleInteractions = productTypes.flatMap(
            (productType) =>
                Object.keys(
                    interactionTypes[productType]
                ) as InteractionTypesKey[]
        );

        // Filter the interactions based on the current goal
        return possibleInteractions
            .filter(
                (interaction) =>
                    interactionTypesInfo[interaction].relatedGoal ===
                    currentGoal
            )
            .filter((interaction) => !interactionTypesInfo[interaction].hidden)
            .map((interaction) => ({
                key: interaction,
                label: interactionTypesInfo[interaction].name,
            }));
    }, [productTypes, currentGoal]);

    return (
        <Panel title="Configure Price Range">
            {availableInteractions.length === 0 && (
                <>
                    <FormDescription>
                        <span className="error">
                            No interactions available for the current goal,
                            please select another goal at previous step.
                        </span>
                    </FormDescription>
                    <FormDescription>
                        <Button
                            variant={"informationOutline"}
                            onClick={() => setStep((prev) => prev - 1)}
                        >
                            Go back to previous step
                        </Button>
                    </FormDescription>
                </>
            )}
            {availableInteractions.length > 0 && (
                <FormDescription>
                    Set a price range for each campaign objective. The budget
                    will be distributed between the referee and referrer
                    according to an automatically optimized allocation key. Frak
                    will apply a 20% management fee to support the campaign
                    delivery and to cover operational costs.
                </FormDescription>
            )}
            {availableInteractions.map(({ key, label }) => (
                <FormFromTo
                    key={key}
                    id={key}
                    label={label}
                    form={form}
                    from={{
                        name: `${key}.from`,
                        label: "From",
                        placeholder: "15,00 €",
                        rightSection: "EUR",
                    }}
                    to={{
                        name: `${key}.to`,
                        label: "To",
                        placeholder: "25,00 €",
                        rightSection: "EUR",
                    }}
                />
            ))}
        </Panel>
    );
}
