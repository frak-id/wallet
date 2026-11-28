import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import type { RewardDefinition } from "@/types/Campaign";
import * as styles from "./campaign-details-sheet.css";

function formatTierRange(tier: {
    minValue: number;
    maxValue?: number;
}): string {
    return tier.maxValue !== undefined
        ? `${tier.minValue}–${tier.maxValue}`
        : `${tier.minValue}+`;
}

export function RewardValue({
    reward,
    currency,
}: {
    reward: RewardDefinition;
    currency: string;
}) {
    const { t } = useTranslation();

    if (reward.amountType === "fixed") {
        return (
            <Text variant="body" weight="medium">
                {t("campaigns.details.config.rewards.fixed", {
                    amount: reward.amount,
                    currency,
                })}
            </Text>
        );
    }

    if (reward.amountType === "percentage") {
        const base = t(
            `campaigns.details.config.rewards.base.${reward.percentOf}`
        );
        return (
            <Stack space="xxs">
                <Text variant="body" weight="medium">
                    {t("campaigns.details.config.rewards.percentage", {
                        percent: reward.percent,
                        base,
                    })}
                </Text>
                <RewardBounds
                    min={reward.minAmount}
                    max={reward.maxAmount}
                    currency={currency}
                />
            </Stack>
        );
    }

    return (
        <Stack space="xs">
            <Text variant="body" weight="medium">
                {t("campaigns.details.config.rewards.tiered", {
                    field: t(
                        `campaigns.details.config.rewards.tierField.${reward.tierField}` as "campaigns.details.config.rewards.tierField.purchase.amount",
                        // A rule authored outside the app can carry any tier
                        // field; show it raw rather than a missing key.
                        { defaultValue: reward.tierField }
                    ),
                })}
            </Text>
            <Stack space="xxs">
                {reward.tiers.map((tier) => (
                    <div className={styles.tierRow} key={formatTierRange(tier)}>
                        <Text as="span" variant="bodySmall" color="secondary">
                            {formatTierRange(tier)}
                        </Text>
                        <Text as="span" variant="bodySmall" weight="medium">
                            {"percent" in tier
                                ? `${tier.percent}%`
                                : `${tier.amount} ${currency}`}
                        </Text>
                    </div>
                ))}
            </Stack>
        </Stack>
    );
}

function RewardBounds({
    min,
    max,
    currency,
}: {
    min?: number;
    max?: number;
    currency: string;
}) {
    const { t } = useTranslation();

    if (min !== undefined && max !== undefined) {
        return (
            <Text variant="caption" color="tertiary">
                {t("campaigns.details.config.rewards.bounds", {
                    min,
                    max,
                    currency,
                })}
            </Text>
        );
    }
    if (min !== undefined) {
        return (
            <Text variant="caption" color="tertiary">
                {t("campaigns.details.config.rewards.boundsMin", {
                    min,
                    currency,
                })}
            </Text>
        );
    }
    if (max !== undefined) {
        return (
            <Text variant="caption" color="tertiary">
                {t("campaigns.details.config.rewards.boundsMax", {
                    max,
                    currency,
                })}
            </Text>
        );
    }
    return null;
}
