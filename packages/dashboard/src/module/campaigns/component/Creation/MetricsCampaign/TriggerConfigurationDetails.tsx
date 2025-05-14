"use client";

import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import type { Campaign } from "@/types/Campaign";
import type { InteractionTypesKey } from "@frak-labs/core-sdk";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

/**
 * Display the details of the configuration
 */
export function TriggerConfigurationDetails() {
    const { watch } = useFormContext<Campaign>();

    // This induce a lot more re-renders than needed, but it's the only fcking way I found to re-render on conditional fields updates
    const campaign = watch();

    const triggerDetails = useMemo(
        () =>
            Object.entries(campaign.triggers)
                .map(([trigger, triggerData]) => {
                    const { rewardChaining, distribution, budget } = campaign;
                    if (!triggerData.cac || triggerData.cac === 0) {
                        return null;
                    }

                    const cac = triggerData.cac;

                    // Get the min and max reward
                    const minReward = distribution?.minMultiplier
                        ? distribution.minMultiplier * cac
                        : cac;
                    const maxReward = distribution?.maxMultiplier
                        ? distribution.maxMultiplier * cac
                        : cac;

                    // Compute remaining values
                    const frak = {
                        avg: cac * 0.2,
                        min: minReward * 0.2,
                        max: maxReward * 0.2,
                    };

                    const userPercent = rewardChaining?.userPercent ?? 0.1;
                    const refereeEarnings = {
                        avg: (cac - frak.avg) * userPercent,
                        min: (minReward - frak.min) * userPercent,
                        max: (maxReward - frak.max) * userPercent,
                    };
                    const referrerEarnings = {
                        avg: cac - frak.avg - refereeEarnings.avg,
                        min: minReward - frak.min - refereeEarnings.min,
                        max: maxReward - frak.max - refereeEarnings.max,
                    };

                    // Compute the amount of this trigger that could be done in the given budget
                    const avgTriggersForBudget = budget.maxEuroDaily / cac;

                    return {
                        trigger,
                        triggerLbl:
                            interactionTypesInfo[trigger as InteractionTypesKey]
                                .name,
                        cac,
                        refereeEarnings,
                        referrerEarnings,
                        frak,
                        budgetType: budget.type,
                        avgTriggersForBudget: Math.round(avgTriggersForBudget),
                    };
                })
                .filter((t) => t !== null),
        [campaign]
    );

    return (
        <div>
            {triggerDetails.map(
                ({
                    trigger,
                    triggerLbl,
                    cac,
                    frak,
                    refereeEarnings,
                    referrerEarnings,
                    budgetType,
                    avgTriggersForBudget,
                }) => (
                    <div key={trigger}>
                        <h4>When {triggerLbl} is triggered</h4>
                        <div>
                            <strong>Average CAC per action:</strong>
                            {cac.toFixed(2)}€
                        </div>
                        <div>
                            <strong>Frak Commission:</strong>
                            {frak.avg.toFixed(2)}€{" "}
                            {frak.min !== frak.max &&
                                `(Between ${frak.min.toFixed(2)}€ and ${frak.max.toFixed(2)}€)`}
                        </div>
                        <div>
                            <strong>Referee Earnings:</strong>
                            {refereeEarnings.avg.toFixed(2)}€{" "}
                            {refereeEarnings.min !== refereeEarnings.max &&
                                `(Between ${refereeEarnings.min.toFixed(2)}€ and ${refereeEarnings.max.toFixed(2)}€)`}
                        </div>
                        <div>
                            <strong>Referrer Earnings:</strong>
                            {referrerEarnings.avg.toFixed(2)}€{" "}
                            {referrerEarnings.min !== referrerEarnings.max &&
                                `(Between ${referrerEarnings.min.toFixed(2)}€ and ${referrerEarnings.max.toFixed(2)}€)`}
                        </div>
                        <div>
                            <strong>
                                Amount of conversion for this campaign{" "}
                                {budgetType}:
                            </strong>
                            {avgTriggersForBudget}
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
