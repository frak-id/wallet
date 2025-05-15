"use client";

import { Info } from "@/assets/icons/Info";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import type { Campaign, CampaignTrigger } from "@/types/Campaign";
import type { InteractionTypesKey } from "@frak-labs/core-sdk";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import styles from "./TriggerConfigurationDetails.module.css";

type TriggerDetails = {
    trigger: InteractionTypesKey;
    triggerLbl: string;
    cac: number;
    refereeEarnings: { avg: number; min: number; max: number };
    referrerEarnings: { avg: number; min: number; max: number };
    distributionType: "range" | "fixed";
    conversions: { lbl: string; value: number }[];
};

/**
 * Display the details of the configuration
 */
export function TriggerConfigurationDetails() {
    const { watch } = useFormContext<Campaign>();

    // This induce a lot more re-renders than needed, but it's the only fcking way I found to re-render on conditional fields updates
    const campaign = watch();

    // Compute the details for each trigger
    const triggerDetails: TriggerDetails[] = useMemo(
        () =>
            Object.entries(campaign.triggers)
                .map(([trigger, triggerData]) => {
                    // Get the min and max values for the trigger
                    const { min, max } = getMinMax(triggerData);
                    if (!min || !max) {
                        return null;
                    }

                    // Get the reward chaining and distribution values
                    const { rewardChaining, distribution, budget } = campaign;

                    // Get the min and max multipliers
                    const minMultiplier =
                        distribution?.type === "range" || min !== max
                            ? (distribution?.minMultiplier ?? 0.7)
                            : 1;
                    const maxMultiplier =
                        distribution?.type === "range" || min !== max
                            ? (distribution?.maxMultiplier ?? 5)
                            : 1;

                    // Compute remaining values
                    const { refereeEarnings, referrerEarnings, cac } =
                        computeRewards({
                            minCac: min,
                            maxCac: max,
                            minMultiplier,
                            maxMultiplier,
                            userPercent: rewardChaining?.userPercent ?? 0.1,
                        });

                    // Extract conversions tags
                    const conversions: { lbl: string; value: number }[] =
                        extractConversions({ budget, cac });

                    return {
                        trigger: trigger as InteractionTypesKey,
                        triggerLbl:
                            interactionTypesInfo[trigger as InteractionTypesKey]
                                .name,
                        cac,
                        refereeEarnings,
                        referrerEarnings,
                        distributionType: distribution?.type ?? "fixed",
                        conversions,
                    };
                })
                .filter((t) => t !== null),
        [campaign]
    );

    return (
        <div className={styles.triggerConfigurationDetails}>
            {triggerDetails.map((triggerItem) => (
                <TriggerDetailsItem
                    key={triggerItem.trigger}
                    {...triggerItem}
                />
            ))}
        </div>
    );
}

function TriggerDetailsItem({
    triggerLbl,
    cac,
    refereeEarnings,
    referrerEarnings,
    conversions,
    distributionType,
}: TriggerDetails) {
    const hasRangeDistribution = distributionType === "range";
    const formatCurrency = (value: number) => `${value.toFixed(2)}€`;
    const renderValueWithRange = (avg: number, min: number, max: number) => {
        if (min === max) {
            return (
                <span style={{ fontWeight: 500 }}>{formatCurrency(avg)}</span>
            );
        }

        return (
            <div className={styles.triggerDetailsRewardRange__column}>
                <span style={{ fontWeight: 500 }}>
                    Avg: {formatCurrency(avg)}
                </span>
                <span style={{ fontWeight: 500 }}>
                    Min: {formatCurrency(min)}
                </span>
                <span style={{ fontWeight: 500 }}>
                    Max: {formatCurrency(max)}
                </span>
            </div>
        );
    };
    return (
        <Panel variant="primary">
            <Row align="center">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                    }}
                >
                    <span style={{ fontSize: 18, fontWeight: 600 }}>
                        When{" "}
                        <span style={{ color: "var(--frak-color-royal-blue)" }}>
                            {triggerLbl}
                        </span>{" "}
                        is triggered
                    </span>
                    <Badge variant="information" size="small">
                        {distributionType} distribution
                    </Badge>
                </div>
            </Row>
            <Row align="center">
                <div style={{ minWidth: 180, alignItems: "center" }}>
                    <div className={styles.triggerDetails__columnTitle}>
                        Average CAC per action
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>
                        {formatCurrency(cac)}
                    </div>
                </div>
                {conversions.map((conversion) => (
                    <div
                        style={{ minWidth: 180, alignItems: "center" }}
                        key={conversion.lbl}
                    >
                        <div className={styles.triggerDetails__columnTitle}>
                            {conversion.lbl}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 500 }}>
                            {conversion.value.toFixed()}
                        </div>
                    </div>
                ))}
            </Row>
            <div style={{ marginTop: 12 }}>
                <div className={styles.triggerDetails__columnTitle}>
                    Reward Distribution
                </div>
                <div className={styles.triggerDetailsReward__columnGroup}>
                    <div className={styles.triggerDetailsReward__column}>
                        <div
                            className={styles.triggerDetailsReward__columnLabel}
                        >
                            Referee Earnings
                        </div>
                        {renderValueWithRange(
                            refereeEarnings.avg,
                            refereeEarnings.min,
                            refereeEarnings.max
                        )}
                    </div>
                    <div className={styles.triggerDetailsReward__column}>
                        <div
                            className={styles.triggerDetailsReward__columnLabel}
                        >
                            Referrer Earnings
                        </div>
                        {renderValueWithRange(
                            referrerEarnings.avg,
                            referrerEarnings.min,
                            referrerEarnings.max
                        )}
                    </div>
                </div>
                {hasRangeDistribution && (
                    <Row align="center">
                        <Info
                            width={14}
                            height={14}
                            style={{ marginRight: 4 }}
                        />
                        <span style={{ fontSize: 12, color: "#888" }}>
                            This campaign uses range distribution, so rewards
                            will vary between min and max values.
                        </span>
                    </Row>
                )}
            </div>
        </Panel>
    );
}

function getMinMax(trigger: CampaignTrigger) {
    const min = (trigger.cac ? trigger.cac : trigger.from) ?? 0;
    const max = (trigger.cac ? trigger.cac : trigger.to) ?? 0;
    return { min, max };
}

/**
 * Helper to compute the rewards that will be distributed to each party
 */
function computeRewards({
    minCac,
    maxCac,
    minMultiplier,
    maxMultiplier,
    userPercent,
}: {
    minCac: number;
    maxCac: number;
    minMultiplier: number;
    maxMultiplier: number;
    userPercent: number;
}) {
    const cac = (minCac + maxCac) / 2;

    // Get the min and max reward
    const minReward = minCac * minMultiplier;
    const maxReward = maxCac * maxMultiplier;

    // Compute remaining values
    const frak = {
        avg: cac * 0.2,
        min: minReward * 0.2,
        max: maxReward * 0.2,
    };

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

    return {
        cac,
        refereeEarnings,
        referrerEarnings,
    };
}

/**
 * Helpers to extract conversion information from the budget
 */
function extractConversions({
    budget,
    cac,
}: { budget: Campaign["budget"]; cac: number }) {
    if (!budget?.type) {
        return [];
    }

    switch (budget.type) {
        case "global":
            return [
                {
                    lbl: "Max conversions",
                    value: (budget.maxEuroDaily * 0.8) / cac,
                },
            ];
        default: {
            return [
                {
                    lbl: `Max ${budget.type} conversions`,
                    value: (budget.maxEuroDaily * 0.8) / cac,
                },
            ];
        }
    }
}
