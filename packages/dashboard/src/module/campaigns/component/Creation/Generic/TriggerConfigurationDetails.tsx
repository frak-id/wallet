"use client";

import { Info } from "@/assets/icons/Info";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import type { Campaign } from "@/types/Campaign";
import type { InteractionTypesKey } from "@frak-labs/core-sdk";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getNumberOfDays } from "../NewCampaign/FormBudget";
import styles from "./TriggerConfigurationDetails.module.css";

type TriggerDetails = {
    trigger: InteractionTypesKey;
    triggerLbl: string;
    cac: number;
    frak: { avg: number; min: number; max: number };
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
                    const { rewardChaining, distribution, budget } = campaign;
                    if (!triggerData.cac || triggerData.cac === 0) {
                        return null;
                    }

                    const cac = triggerData.cac;

                    const minMultiplier =
                        distribution?.type === "range"
                            ? (distribution?.minMultiplier ?? 0.7)
                            : 1;
                    const maxMultiplier =
                        distribution?.type === "range"
                            ? (distribution?.maxMultiplier ?? 5)
                            : 1;

                    // Compute remaining values
                    const { frak, refereeEarnings, referrerEarnings } =
                        computeRewards({
                            cac,
                            minMultiplier,
                            maxMultiplier,
                            userPercent: rewardChaining?.userPercent ?? 0.1,
                        });

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
                        frak,
                        distributionType: distribution?.type ?? "fixed",
                        conversions,
                    };
                })
                .filter((t) => t !== null),
        [campaign]
    );

    return (
        <div>
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
    frak,
    refereeEarnings,
    referrerEarnings,
    conversions,
    distributionType,
}: TriggerDetails) {
    const hasRangeDistribution = frak.min !== frak.max;
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
                            Frak Commission
                        </div>
                        {renderValueWithRange(frak.avg, frak.min, frak.max)}
                    </div>
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

/**
 * Helper to compute the rewards that will be distributed to each party
 */
function computeRewards({
    cac,
    minMultiplier,
    maxMultiplier,
    userPercent,
}: {
    cac: number;
    minMultiplier: number;
    maxMultiplier: number;
    userPercent: number;
}) {
    // Get the min and max reward
    const minReward = cac * minMultiplier;
    const maxReward = cac * maxMultiplier;

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
        frak,
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
        case "daily":
            return [
                {
                    lbl: "Average daily conversions",
                    value: (budget.maxEuroDaily * 0.8) / cac,
                },
            ];
        default: {
            const numberOfDays = getNumberOfDays(budget.type);
            const dailyBudget = budget.maxEuroDaily / numberOfDays;
            return [
                {
                    lbl: "Average daily conversions",
                    value: (dailyBudget * 0.8) / cac,
                },
                {
                    lbl: `Max ${budget.type} conversions`,
                    value: (budget.maxEuroDaily * 0.8) / cac,
                },
            ];
        }
    }
}
