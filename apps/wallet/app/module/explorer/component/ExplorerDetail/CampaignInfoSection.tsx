import type { EstimatedReward } from "@frak-labs/core-sdk";
import { formatAmount } from "@frak-labs/core-sdk";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    ClockIcon,
    CoinsIcon,
} from "@frak-labs/design-system/icons";
import {
    buildPercentageExample,
    buildTierExample,
    type RewardExample,
} from "@frak-labs/core-sdk/rewards";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { InstructionList } from "@/module/common/component/InstructionList";
import type { CampaignView } from "../../campaignView";
import * as styles from "./index.css";

type FlatReward = Exclude<EstimatedReward, { payoutType: "tiered" }>;
type TieredReward = Extract<EstimatedReward, { payoutType: "tiered" }>;
type RewardTier = TieredReward["tiers"][number];

export function CampaignInfoSection({
    view,
    merchantName,
}: {
    view: CampaignView | null;
    merchantName: string;
}) {
    const { t } = useTranslation();
    return (
        <>
            {view && <CampaignInfoCard view={view} />}
            <InstructionList
                title={t("explorer.detail.instructions")}
                steps={[
                    {
                        title: t("explorer.detail.step1Title"),
                        description: t("explorer.detail.step1Description"),
                    },
                    {
                        title: t("explorer.detail.step2Title", {
                            amount: view?.headlineReferrerReward ?? "",
                        }),
                        description: t("explorer.detail.step2Description", {
                            name: merchantName,
                        }),
                    },
                    {
                        title: t("explorer.detail.step3Title"),
                        description: t("explorer.detail.step3Description"),
                    },
                ]}
            />
        </>
    );
}

function CampaignInfoCard({ view }: { view: CampaignView }) {
    const { t } = useTranslation();
    return (
        <Stack space="s">
            {view.status === "upcoming" && view.formattedStartDate && (
                <Badge
                    variant="info"
                    size="medium"
                    className={styles.startingBadge}
                >
                    <ClockIcon width={14} height={14} />
                    {t("explorer.detail.startingOn", {
                        date: view.formattedStartDate,
                    })}
                </Badge>
            )}
            <InfoCard>
                {view.daysRemaining != null && view.formattedEndDate && (
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("explorer.detail.endsIn", {
                            count: view.daysRemaining,
                        })}
                        action={
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                className={styles.infoValue}
                            >
                                <CalendarIcon width={14} height={14} />{" "}
                                {view.formattedEndDate}
                            </Text>
                        }
                    />
                )}
                {view.referrer && (
                    <RewardRow
                        labelKey="explorer.detail.referrerReward"
                        reward={view.referrer}
                        minPurchase={view.minPurchaseAmount}
                    />
                )}
                {view.referee && (
                    <RewardRow
                        labelKey="explorer.detail.refereeReward"
                        reward={view.referee}
                        minPurchase={view.minPurchaseAmount}
                    />
                )}
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("explorer.detail.earningsAvailability")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {view.isImmediate
                                ? t("explorer.detail.immediate")
                                : t("explorer.detail.pendingDays", {
                                      count: view.pendingDays,
                                  })}
                        </Text>
                    }
                />
                {view.minPurchaseDisplay && (
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("explorer.detail.minPurchase")}
                        action={
                            <Text variant="bodySmall" weight="medium">
                                {view.minPurchaseDisplay}
                            </Text>
                        }
                    />
                )}
            </InfoCard>
        </Stack>
    );
}

function RewardRow({
    labelKey,
    reward,
    minPurchase,
}: {
    labelKey: string;
    reward: EstimatedReward;
    minPurchase: number | undefined;
}) {
    const { t } = useTranslation();
    if (reward.payoutType === "tiered") {
        return <TieredRewardBlock labelKey={labelKey} reward={reward} />;
    }
    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            align={reward.payoutType === "percentage" ? "top" : "center"}
            label={t(labelKey)}
            action={<RewardValue reward={reward} minPurchase={minPurchase} />}
        />
    );
}

function RewardValue({
    reward,
    minPurchase,
}: {
    reward: FlatReward;
    minPurchase: number | undefined;
}) {
    const { t } = useTranslation();
    if (reward.payoutType === "fixed") {
        return (
            <Text
                variant="bodySmall"
                weight="medium"
                className={styles.infoValue}
            >
                <CoinsIcon width={16} height={16} />{" "}
                {formatAmount(reward.amount.eurAmount)}
            </Text>
        );
    }
    const example = buildPercentageExample(reward, minPurchase);
    return (
        <Stack space="xxs" align="right">
            <Text
                variant="bodySmall"
                weight="medium"
                className={styles.infoValue}
            >
                <CoinsIcon width={16} height={16} />{" "}
                {t("explorer.detail.percentOfBasket", {
                    percent: reward.percent,
                })}
            </Text>
            {example && <ExampleText example={example} />}
        </Stack>
    );
}

function TieredRewardBlock({
    labelKey,
    reward,
}: {
    labelKey: string;
    reward: TieredReward;
}) {
    const { t } = useTranslation();
    return (
        <Box paddingX="m" paddingY="s" className={styles.tierBlock}>
            <div className={styles.tierHeader}>
                <Text variant="bodySmall" color="secondary" weight="bold">
                    {t(labelKey)}
                </Text>
                <CoinsIcon width={16} height={16} />
            </div>
            <Stack space="xs">
                {reward.tiers.map((tier) => (
                    <TierRow key={tierKey(tier)} tier={tier} />
                ))}
            </Stack>
        </Box>
    );
}

function TierRow({ tier }: { tier: RewardTier }) {
    const { t } = useTranslation();
    const range =
        tier.maxValue == null
            ? t("explorer.detail.tierAndAbove", {
                  min: formatAmount(tier.minValue),
              })
            : `${tier.minValue}–${formatAmount(tier.maxValue)}`;

    if ("amount" in tier) {
        return (
            <div className={styles.tierRow}>
                <Text variant="bodySmall" color="secondary">
                    {range}
                </Text>
                <Text variant="bodySmall" weight="medium">
                    {formatAmount(tier.amount.eurAmount)}
                </Text>
            </div>
        );
    }

    const example = buildTierExample(
        tier.percent,
        tier.minValue,
        tier.maxValue
    );
    return (
        <div className={styles.tierRow}>
            <Text variant="bodySmall" color="secondary">
                {range}
            </Text>
            <Stack space="xxs" align="right">
                <Text variant="bodySmall" weight="medium">
                    {t("explorer.detail.percentOfBasket", {
                        percent: tier.percent,
                    })}
                </Text>
                {example && <ExampleText example={example} />}
            </Stack>
        </div>
    );
}

function ExampleText({ example }: { example: RewardExample }) {
    const { t } = useTranslation();
    return (
        <Text variant="tiny" color="tertiary">
            {t("explorer.detail.percentExample", {
                reward: formatAmount(example.reward),
                basket: formatAmount(example.basket),
            })}
        </Text>
    );
}

function tierKey(tier: RewardTier): string {
    const value = "amount" in tier ? tier.amount.eurAmount : tier.percent;
    return `${tier.minValue}-${tier.maxValue ?? "inf"}-${value}`;
}
