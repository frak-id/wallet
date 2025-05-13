import type { Campaign } from "@/types/Campaign";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

/**
 * Display the details of the configuration
 */
export function TriggerConfigurationDetails() {
    const { watch } = useFormContext<Campaign>();

    const userPercent = watch("rewardChaining.userPercent");
    const distribution = watch("distribution");
    const triggers = watch("triggers");
    const budget = watch("budget");

    const triggerDetails = useMemo(
        () =>
            Object.entries(triggers)
                .map(([trigger, triggerData]) => {
                    if (triggerData.from === 0) {
                        return null;
                    }

                    console.log(distribution);

                    const distributionType = distribution?.type ?? "fixed";
                    // Get the average CAC per trigger
                    const avgCac =
                        distributionType === "fixed"
                            ? triggerData.from
                            : (triggerData.from + triggerData.to) / 2;

                    // Get the min and max reward
                    const minReward = distribution?.minMultiplier
                        ? distribution.minMultiplier * triggerData.from
                        : triggerData.from;
                    const maxReward = distribution?.maxMultiplier
                        ? distribution.maxMultiplier * triggerData.to
                        : triggerData.to;

                    // Compute remaining values
                    const frak = {
                        avg: avgCac * 0.2,
                        min: minReward * 0.2,
                        max: maxReward * 0.2,
                    };

                    const refereeEarnings = {
                        avg: (avgCac - frak.avg) * (userPercent ?? 0.1),
                        min: (minReward - frak.min) * (userPercent ?? 0.1),
                        max: (maxReward - frak.max) * (userPercent ?? 0.1),
                    };
                    const referrerEarnings = {
                        avg: avgCac - frak.avg - refereeEarnings.avg,
                        min: minReward - frak.min - refereeEarnings.min,
                        max: maxReward - frak.max - refereeEarnings.max,
                    };

                    // Compute the amount of this trigger that could be done in the given budget
                    const avgTriggersForBudget = budget.maxEuroDaily / avgCac;

                    return {
                        trigger,
                        avgCac,
                        refereeEarnings,
                        referrerEarnings,
                        frak,
                        budgetType: budget.type,
                        avgTriggersForBudget: Math.round(avgTriggersForBudget),
                    };
                })
                .filter((t) => t !== null),
        [triggers, userPercent, distribution, budget]
    );

    return (
        <div>
            {triggerDetails.map(
                ({
                    trigger,
                    avgCac,
                    frak,
                    refereeEarnings,
                    referrerEarnings,
                    budgetType,
                    avgTriggersForBudget,
                }) => (
                    <div key={trigger}>
                        <h4>When {trigger} is triggered</h4>
                        <div>
                            <strong>Average CAC per action:</strong>
                            {avgCac.toFixed(2)}€
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
