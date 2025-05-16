"use client";

import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
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
import { useFormContext } from "react-hook-form";
import { FormTrigger } from "../Generic/FormTrigger";
import styles from "./FormTriggersCac.module.css";

export function FormTriggersCac({
    productTypes = [],
}: {
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

    const { getFieldState } = useFormContext();
    const triggerState = getFieldState("triggers");

    return (
        <Panel title="Set a target cost per action">
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
            <FormDescription>
                <span>Target CPA</span>
                <br />
                <span className={styles.notice}>
                    "Target CPA" defines your overall acquisition cost per
                    target action (your goal) to generate the maximum number of
                    conversions at a cost equal to or lower than the target cost
                    per action you set. Some conversions may cost more or less
                    than your target amount.
                </span>
            </FormDescription>
            {availableInteractions.length > 0 &&
                availableInteractions.map(({ key }) => (
                    <FormTrigger
                        key={key}
                        interaction={key}
                        disabled={false}
                        defaultChecked={availableInteractions.length === 1}
                    />
                ))}
            {triggerState.error && (
                <p className="error">
                    {typeof triggerState.error === "string"
                        ? triggerState.error
                        : triggerState.error?.message}
                </p>
            )}
        </Panel>
    );
}
