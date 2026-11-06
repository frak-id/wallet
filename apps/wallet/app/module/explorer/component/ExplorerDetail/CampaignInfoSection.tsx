import type { Currency, EstimatedReward } from "@frak-labs/core-sdk";
import { formatAmount, getCurrencyAmountKey } from "@frak-labs/core-sdk";
import {
    buildPercentageExample,
    buildTierExample,
    isMatchedItemsBasis,
    type RewardExample,
} from "@frak-labs/core-sdk/rewards";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    ClockIcon,
    CoinsIcon,
} from "@frak-labs/design-system/icons";
import {
    formatAmountRange,
    formatRewardAmount,
} from "@frak-labs/wallet-shared";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { InstructionList } from "@/module/common/component/InstructionList";
import type { CampaignView } from "../../campaignView";
import type { RewardOffer } from "../../rewardOffer";
import * as styles from "./index.css";

type FlatReward = Exclude<EstimatedReward, { payoutType: "tiered" }>;
type TieredReward = Extract<EstimatedReward, { payoutType: "tiered" }>;
type RewardTier = TieredReward["tiers"][number];

export function CampaignInfoSection({
    view,
    offer,
    merchantName,
}: {
    view: CampaignView | null;
    offer: RewardOffer;
    merchantName: string;
}) {
    const { t } = useTranslation();
    return (
        <>
            {view && (
                <CampaignInfoCards
                    view={view}
                    offer={offer}
                    merchantName={merchantName}
                />
            )}
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

function CampaignInfoCards({
    view,
    offer,
    merchantName,
}: {
    view: CampaignView;
    offer: RewardOffer;
    merchantName: string;
}) {
    const { t } = useTranslation();
    const { purchase } = offer;
    return (
        <>
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
            {purchase && (
                <OfferSection
                    title={t("explorer.offer.purchaseTitle")}
                    note={
                        purchase.welcomeBonus &&
                        t(
                            purchase.cashback
                                ? "explorer.offer.welcomeBonusNote"
                                : "explorer.offer.welcomeBonusOnlyNote",
                            { name: merchantName }
                        )
                    }
                >
                    {purchase.total ? (
                        <RewardRow
                            labelKey={
                                purchase.welcomeBonus
                                    ? "explorer.offer.welcomeBonus"
                                    : "explorer.offer.cashback"
                            }
                            reward={purchase.total}
                            minPurchase={view.minPurchaseAmount}
                            currency={purchase.totalCurrency}
                        />
                    ) : (
                        <InfoRow
                            labelVariant="bodySmall"
                            labelColor="secondary"
                            label={t("explorer.offer.welcomeBonus")}
                            action={
                                <Text
                                    variant="bodySmall"
                                    weight="medium"
                                    className={styles.infoValue}
                                >
                                    <CoinsIcon width={16} height={16} />{" "}
                                    {purchase.amount}
                                </Text>
                            }
                        />
                    )}
                </OfferSection>
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
                        currency={view.payoutCurrency}
                    />
                )}
                {view.referee && (
                    <RewardRow
                        labelKey="explorer.detail.refereeReward"
                        reward={view.referee}
                        minPurchase={view.minPurchaseAmount}
                        currency={view.payoutCurrency}
                    />
                )}
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("explorer.detail.earningsAvailability")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {view.isImmediate || view.pendingDays == null
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
                {view.hasProductScope && (
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("explorer.detail.productScopeNote")}
                    />
                )}
            </InfoCard>
        </>
    );
}

function OfferSection({
    title,
    note,
    children,
}: {
    title: string;
    note?: string;
    children: ReactNode;
}) {
    return (
        <>
            <Text variant="bodySmall" color="secondary">
                {title}
            </Text>
            <Stack space="s">
                <InfoCard>{children}</InfoCard>
                {note && (
                    <Text variant="caption" color="tertiary">
                        {note}
                    </Text>
                )}
            </Stack>
        </>
    );
}

function RewardRow({
    labelKey,
    reward,
    minPurchase,
    currency,
}: {
    labelKey: DefaultTranslationKey;
    reward: EstimatedReward;
    minPurchase: number | undefined;
    currency?: Currency;
}) {
    const { t } = useTranslation();
    if (reward.payoutType === "tiered") {
        return (
            <TieredRewardBlock
                labelKey={labelKey}
                reward={reward}
                currency={currency}
            />
        );
    }
    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            align={reward.payoutType === "percentage" ? "top" : "center"}
            label={t(labelKey)}
            action={
                <RewardValue
                    reward={reward}
                    minPurchase={minPurchase}
                    currency={currency}
                />
            }
        />
    );
}

function RewardValue({
    reward,
    minPurchase,
    currency,
}: {
    reward: FlatReward;
    minPurchase: number | undefined;
    currency?: Currency;
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
                {formatRewardAmount(
                    reward.amount[getCurrencyAmountKey(currency)],
                    currency
                )}
            </Text>
        );
    }
    // `buildPercentageExample` assumes a whole-basket reference, wrong for a
    // percent applied only to matched items.
    const matchedItemsBasis = isMatchedItemsBasis(reward);
    const example = matchedItemsBasis
        ? undefined
        : buildPercentageExample(reward, minPurchase, currency);
    return (
        <Stack space="xxs" align="right">
            <Text
                variant="bodySmall"
                weight="medium"
                className={styles.infoValue}
            >
                <CoinsIcon width={16} height={16} />{" "}
                {t(
                    matchedItemsBasis
                        ? "explorer.detail.percentOfEligible"
                        : "explorer.detail.percentOfBasket",
                    { percent: reward.percent }
                )}
            </Text>
            {example && <ExampleText example={example} currency={currency} />}
        </Stack>
    );
}

function TieredRewardBlock({
    labelKey,
    reward,
    currency,
}: {
    labelKey: DefaultTranslationKey;
    reward: TieredReward;
    currency?: Currency;
}) {
    const { t } = useTranslation();
    const matchedItemsBasis = isMatchedItemsBasis(reward);
    return (
        <Box paddingX="m" paddingY="s" className={styles.tierBlock}>
            <Spread space="s">
                <Text variant="bodySmall" color="secondary" weight="bold">
                    {t(labelKey)}
                </Text>
                <CoinsIcon width={16} height={16} />
            </Spread>
            <Stack space="xs">
                {reward.tiers.map((tier) => (
                    <TierRow
                        key={tierKey(tier, currency)}
                        tier={tier}
                        isMatchedItemsBasis={matchedItemsBasis}
                        currency={currency}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function TierRow({
    tier,
    isMatchedItemsBasis,
    currency,
}: {
    tier: RewardTier;
    isMatchedItemsBasis: boolean;
    currency?: Currency;
}) {
    const { t } = useTranslation();
    const range =
        tier.maxValue == null
            ? t("explorer.detail.tierAndAbove", {
                  min: formatAmount(tier.minValue, currency),
              })
            : formatAmountRange(tier.minValue, tier.maxValue, currency);

    if ("amount" in tier) {
        return (
            <Spread align="top" space="m">
                <Text variant="bodySmall" color="secondary">
                    {range}
                </Text>
                <Text variant="bodySmall" weight="medium">
                    {formatRewardAmount(
                        tier.amount[getCurrencyAmountKey(currency)],
                        currency
                    )}
                </Text>
            </Spread>
        );
    }

    // `buildTierExample` assumes a whole-basket reference, wrong for a percent
    // applied only to matched items.
    const example = isMatchedItemsBasis
        ? undefined
        : buildTierExample(tier.percent, tier.minValue, tier.maxValue);
    return (
        <Spread align="top" space="m">
            <Text variant="bodySmall" color="secondary">
                {range}
            </Text>
            <Stack space="xxs" align="right">
                <Text variant="bodySmall" weight="medium">
                    {t(
                        isMatchedItemsBasis
                            ? "explorer.detail.percentOfEligible"
                            : "explorer.detail.percentOfBasket",
                        { percent: tier.percent }
                    )}
                </Text>
                {example && (
                    <ExampleText example={example} currency={currency} />
                )}
            </Stack>
        </Spread>
    );
}

function ExampleText({
    example,
    currency,
}: {
    example: RewardExample;
    currency?: Currency;
}) {
    const { t } = useTranslation();
    return (
        <Text variant="tiny" color="tertiary">
            {t("explorer.detail.percentExample", {
                reward: formatRewardAmount(example.reward, currency),
                basket: formatAmount(example.basket, currency),
            })}
        </Text>
    );
}

function tierKey(tier: RewardTier, currency?: Currency): string {
    const value =
        "amount" in tier
            ? tier.amount[getCurrencyAmountKey(currency)]
            : tier.percent;
    return `${tier.minValue}-${tier.maxValue ?? "inf"}-${value}`;
}
