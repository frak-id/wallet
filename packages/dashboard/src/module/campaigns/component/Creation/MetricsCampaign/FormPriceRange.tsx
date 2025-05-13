import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { FormFromTo } from "@/module/campaigns/component/Creation/MetricsCampaign/FormFromTo";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import {
    type InteractionTypesKey,
    type ProductTypesKey,
    interactionTypes,
} from "@frak-labs/core-sdk";
import { Button } from "@shared/module/component/Button";
import { useAtomValue, useSetAtom } from "jotai";
import { useMemo } from "react";
import { FormNumber } from "./FormNumber";

export function FormPriceRange({
    productTypes = [],
    distributionType,
}: {
    productTypes: ProductTypesKey[];
    distributionType: "fixed" | "range";
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
        <Panel title="Configure CAC">
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
            {distributionType === "fixed" &&
                availableInteractions.length > 0 && (
                    <FixedPriceInputs
                        availableInteractions={availableInteractions}
                    />
                )}
            {distributionType === "range" &&
                availableInteractions.length > 0 && (
                    <RangePriceInputs
                        availableInteractions={availableInteractions}
                    />
                )}
        </Panel>
    );
}

function FixedPriceInputs({
    availableInteractions,
}: {
    availableInteractions: { key: InteractionTypesKey; label: string }[];
}) {
    return (
        <>
            <FormDescription>
                Set the fixed CAC for each campaign objective. The budget will
                be distributed between the referee and referrer according to the
                parameters below.
            </FormDescription>
            {availableInteractions.map(({ key, label }) => (
                <FormNumber
                    key={key}
                    id={key}
                    label={label}
                    field={{
                        keys: [`triggers.${key}.from`, `triggers.${key}.to`],
                        label: "CAC",
                        placeholder: "25,00 €",
                        rightSection: "EUR",
                    }}
                />
            ))}
        </>
    );
}

function RangePriceInputs({
    availableInteractions,
}: {
    availableInteractions: { key: InteractionTypesKey; label: string }[];
}) {
    return (
        <>
            <FormDescription>
                Set a CAC price range for each campaign objective. The budget
                will be distributed between the referee and referrer according
                to the parameters below.
            </FormDescription>
            {availableInteractions.map(({ key, label }) => (
                <FormFromTo
                    key={key}
                    id={key}
                    label={label}
                    from={{
                        name: `triggers.${key}.from`,
                        label: "From",
                        placeholder: "15,00 €",
                        rightSection: "EUR",
                    }}
                    to={{
                        name: `triggers.${key}.to`,
                        label: "To",
                        placeholder: "25,00 €",
                        rightSection: "EUR",
                    }}
                />
            ))}
        </>
    );
}
