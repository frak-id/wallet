import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CartIcon,
    CommunityIcon,
    ShareIcon,
    SparklesIcon,
} from "@frak-labs/design-system/icons";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getCampaignDetail } from "@/module/campaigns/api/campaignApi";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { formatDate } from "@/module/common/utils/formatDate";
import { currencyStore } from "@/stores/currencyStore";
import type {
    BudgetConfigItem,
    Campaign,
    CampaignMetadata,
    CampaignRuleDefinition,
    CampaignTrigger,
    ConditionGroup,
    RewardChaining,
    RewardDefinition,
    RuleCondition,
    RuleConditions,
} from "@/types/Campaign";
import * as styles from "./campaign-details-sheet.css";
import { Section } from "./parts";

/**
 * Read-only recap of a campaign's configuration — the trigger, rewards,
 * conditions, limits, budget, targeting and schedule a merchant set up.
 * Reuses the full `Campaign` config (not the analytics stats), fetched on
 * the same query key as the campaign detail/edit screens so the cache is
 * shared.
 */
export function ConfigTab({ campaignId }: { campaignId: string }) {
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data: campaign, isPending } = useQuery({
        queryKey: ["campaign", campaignId, isDemoMode ? "demo" : "live"],
        queryFn: () =>
            getCampaignDetail({ campaignId, merchantId, isDemoMode }),
    });

    if (isPending) {
        return <Skeleton variant="rect" height={320} />;
    }

    if (!campaign) {
        return null;
    }

    return <ConfigContent campaign={campaign} />;
}

function ConfigContent({ campaign }: { campaign: Campaign }) {
    const currency = currencyStore((s) => s.preferredCurrency).toUpperCase();
    const { rule, metadata, budgetConfig } = campaign;

    return (
        <Stack space="l">
            <TriggerSection trigger={rule.trigger} />
            <RewardsSection rewards={rule.rewards} currency={currency} />
            <ConditionsSection conditions={rule.conditions} />
            <LimitsSection rule={rule} />
            <BudgetSection budgetConfig={budgetConfig} currency={currency} />
            <TargetingSection metadata={metadata} />
            <ScheduleSection campaign={campaign} />
        </Stack>
    );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** Label on the left, value on the right, hairline-separated rows. */
function DefinitionRow({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className={styles.definitionRow}>
            <Text as="span" variant="bodySmall" color="secondary">
                {label}
            </Text>
            <span className={styles.definitionValue}>{children}</span>
        </div>
    );
}

function ValueText({ children }: { children: ReactNode }) {
    return (
        <Text as="span" variant="bodySmall" weight="medium">
            {children}
        </Text>
    );
}

/* ------------------------------------------------------------------ */
/* Trigger                                                             */
/* ------------------------------------------------------------------ */

function TriggerGlyph({ trigger }: { trigger: CampaignTrigger }) {
    switch (trigger) {
        case "purchase":
            return <CartIcon width={20} height={20} />;
        case "referral":
            return <CommunityIcon width={20} height={20} />;
        case "create_referral_link":
            return <ShareIcon width={20} height={20} />;
        default:
            return <SparklesIcon width={20} height={20} />;
    }
}

function TriggerSection({ trigger }: { trigger: CampaignTrigger }) {
    const { t } = useTranslation();
    return (
        <Section title={t("campaigns.details.config.trigger.title")}>
            <Card radius="m">
                <div className={styles.triggerCallout}>
                    <span className={styles.triggerIcon}>
                        <TriggerGlyph trigger={trigger} />
                    </span>
                    <Stack space="xxs">
                        <Text variant="body" weight="medium">
                            {t(`campaigns.details.config.trigger.${trigger}`)}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("campaigns.details.config.trigger.description")}
                        </Text>
                    </Stack>
                </div>
            </Card>
        </Section>
    );
}

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

function RewardsSection({
    rewards,
    currency,
}: {
    rewards: RewardDefinition[];
    currency: string;
}) {
    const { t } = useTranslation();
    const title = t("campaigns.details.config.rewards.title");

    if (!rewards || rewards.length === 0) {
        return (
            <Section title={title}>
                <Card radius="m">
                    <Text variant="bodySmall" color="secondary">
                        {t("campaigns.details.config.rewards.empty")}
                    </Text>
                </Card>
            </Section>
        );
    }

    return (
        <Section title={title}>
            <Stack space="m">
                {rewards.map((reward, index) => (
                    <RewardCard
                        key={`${reward.recipient}-${index}`}
                        reward={reward}
                        currency={currency}
                    />
                ))}
            </Stack>
        </Section>
    );
}

function RewardCard({
    reward,
    currency,
}: {
    reward: RewardDefinition;
    currency: string;
}) {
    const { t } = useTranslation();
    const recipientVariant =
        reward.recipient === "referrer" ? "info" : "success";

    return (
        <Card radius="m">
            <Stack space="s">
                <div className={styles.rewardHeader}>
                    <Badge variant={recipientVariant} size="small">
                        {t(
                            `campaigns.details.config.rewards.recipient.${reward.recipient}`
                        )}
                    </Badge>
                    <Text variant="caption" color="tertiary">
                        {t(
                            `campaigns.details.config.rewards.recipientHint.${reward.recipient}`
                        )}
                    </Text>
                </div>
                <RewardValue reward={reward} currency={currency} />
                {reward.description && (
                    <Text variant="bodySmall" color="secondary">
                        {reward.description}
                    </Text>
                )}
                {reward.chaining && <ChainingNote chaining={reward.chaining} />}
            </Stack>
        </Card>
    );
}

function formatTierRange(tier: {
    minValue: number;
    maxValue?: number;
}): string {
    return tier.maxValue !== undefined
        ? `${tier.minValue}–${tier.maxValue}`
        : `${tier.minValue}+`;
}

function RewardValue({
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
                    field: reward.tierField,
                })}
            </Text>
            <Stack space="xxs">
                {reward.tiers.map((tier, index) => (
                    <div className={styles.tierRow} key={index}>
                        <Text as="span" variant="bodySmall" color="secondary">
                            {formatTierRange(tier)}
                        </Text>
                        <Text as="span" variant="bodySmall" weight="medium">
                            {tier.amount} {currency}
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

function ChainingNote({ chaining }: { chaining: RewardChaining }) {
    const { t } = useTranslation();
    const detail = chaining.maxDepth
        ? t("campaigns.details.config.rewards.chainingDetail", {
              decay: chaining.deperditionPerLevel,
              depth: chaining.maxDepth,
          })
        : t("campaigns.details.config.rewards.chainingDetailNoDepth", {
              decay: chaining.deperditionPerLevel,
          });

    return (
        <Inline space="xs" alignY="center">
            <Badge variant="neutral" size="small">
                {t("campaigns.details.config.rewards.chaining")}
            </Badge>
            <Text variant="caption" color="tertiary">
                {detail}
            </Text>
        </Inline>
    );
}

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

const operatorLabels: Record<string, string> = {
    eq: "=",
    neq: "≠",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
    in: "in",
    not_in: "not in",
    contains: "contains",
    starts_with: "starts with",
    ends_with: "ends with",
    exists: "exists",
    not_exists: "does not exist",
    between: "between",
};

function isConditionGroup(
    condition: RuleCondition | ConditionGroup
): condition is ConditionGroup {
    return "logic" in condition && "conditions" in condition;
}

function isConditionsEmpty(conditions: RuleConditions): boolean {
    if (Array.isArray(conditions)) {
        return conditions.length === 0;
    }
    return conditions.conditions.length === 0;
}

function formatConditionValue(value: string | number | boolean | null): string {
    if (value === null) return "∅";
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
}

function humanizeField(field: string): string {
    return field.replace(/\./g, " › ");
}

function ConditionChip({ condition }: { condition: RuleCondition }) {
    const { t } = useTranslation();
    const operator = operatorLabels[condition.operator] ?? condition.operator;
    const field = humanizeField(condition.field);

    let value = "";
    if (condition.operator === "between") {
        value = `${formatConditionValue(condition.value)} ${t(
            "campaigns.details.config.conditions.and"
        )} ${formatConditionValue(condition.valueTo ?? null)}`;
    } else if (
        condition.operator !== "exists" &&
        condition.operator !== "not_exists"
    ) {
        value = formatConditionValue(condition.value);
    }

    return (
        <Badge variant="neutral" size="small">
            {field} {operator}
            {value ? ` ${value}` : ""}
        </Badge>
    );
}

function ConditionGroupDisplay({ group }: { group: ConditionGroup }) {
    const { t } = useTranslation();
    if (group.conditions.length === 0) return null;

    const logicLabel =
        group.logic === "all"
            ? t("campaigns.details.config.conditions.all")
            : group.logic === "any"
              ? t("campaigns.details.config.conditions.any")
              : t("campaigns.details.config.conditions.noneOf");

    return (
        <Stack space="xs">
            <Text variant="caption" color="tertiary">
                {logicLabel}
            </Text>
            <div className={styles.tagRow}>
                {group.conditions.map((condition, index) =>
                    isConditionGroup(condition) ? (
                        <ConditionGroupDisplay
                            key={`group-${index}`}
                            group={condition}
                        />
                    ) : (
                        <ConditionChip
                            key={`${condition.field}-${index}`}
                            condition={condition}
                        />
                    )
                )}
            </div>
        </Stack>
    );
}

function ConditionsSection({ conditions }: { conditions: RuleConditions }) {
    const { t } = useTranslation();

    return (
        <Section title={t("campaigns.details.config.conditions.title")}>
            <Card radius="m">
                {isConditionsEmpty(conditions) ? (
                    <Text variant="bodySmall" color="secondary">
                        {t("campaigns.details.config.conditions.none")}
                    </Text>
                ) : (
                    <Stack space="s">
                        <Text variant="bodySmall" color="secondary">
                            {t(
                                "campaigns.details.config.conditions.description"
                            )}
                        </Text>
                        {Array.isArray(conditions) ? (
                            <div className={styles.tagRow}>
                                {conditions.map((condition, index) => (
                                    <ConditionChip
                                        key={`${condition.field}-${index}`}
                                        condition={condition}
                                    />
                                ))}
                            </div>
                        ) : (
                            <ConditionGroupDisplay group={conditions} />
                        )}
                    </Stack>
                )}
            </Card>
        </Section>
    );
}

/* ------------------------------------------------------------------ */
/* Limits & timing                                                     */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number, locale: string): string {
    const unitFormat = (value: number, unit: "day" | "hour" | "minute") =>
        new Intl.NumberFormat(locale, {
            style: "unit",
            unit,
            unitDisplay: "long",
        }).format(value);

    if (seconds % 86400 === 0) return unitFormat(seconds / 86400, "day");
    if (seconds % 3600 === 0) return unitFormat(seconds / 3600, "hour");
    return unitFormat(Math.round(seconds / 60), "minute");
}

function LimitsSection({ rule }: { rule: CampaignRuleDefinition }) {
    const { t, i18n } = useTranslation();
    const unlimited = t("campaigns.details.config.limits.unlimited");
    const lockup = rule.defaultLockupSeconds;

    return (
        <Section title={t("campaigns.details.config.limits.title")}>
            <Card radius="m">
                <div>
                    <DefinitionRow
                        label={t(
                            "campaigns.details.config.limits.pendingExpiration"
                        )}
                    >
                        <ValueText>
                            {rule.pendingRewardExpirationDays !== undefined
                                ? t(
                                      "campaigns.details.config.limits.pendingExpirationValue",
                                      {
                                          count: rule.pendingRewardExpirationDays,
                                      }
                                  )
                                : unlimited}
                        </ValueText>
                    </DefinitionRow>
                    <DefinitionRow
                        label={t("campaigns.details.config.limits.lockup")}
                    >
                        <ValueText>
                            {lockup && lockup > 0
                                ? t(
                                      "campaigns.details.config.limits.lockupValue",
                                      {
                                          duration: formatDuration(
                                              lockup,
                                              i18n.language
                                          ),
                                      }
                                  )
                                : t(
                                      "campaigns.details.config.limits.lockupNone"
                                  )}
                        </ValueText>
                    </DefinitionRow>
                    <DefinitionRow
                        label={t(
                            "campaigns.details.config.limits.maxRewardsPerUser"
                        )}
                    >
                        <ValueText>
                            {rule.maxRewardsPerUser ?? unlimited}
                        </ValueText>
                    </DefinitionRow>
                    <DefinitionRow
                        label={t(
                            "campaigns.details.config.limits.merchantMaxRewardsPerUser"
                        )}
                    >
                        <ValueText>
                            {rule.merchantMaxRewardsPerUser ?? unlimited}
                        </ValueText>
                    </DefinitionRow>
                </div>
            </Card>
        </Section>
    );
}

/* ------------------------------------------------------------------ */
/* Budget                                                              */
/* ------------------------------------------------------------------ */

function budgetPeriodKey(
    durationInSeconds: number | null
): "global" | "daily" | "weekly" | "monthly" {
    switch (durationInSeconds) {
        case 86400:
            return "daily";
        case 604800:
            return "weekly";
        case 2592000:
            return "monthly";
        default:
            return "global";
    }
}

function BudgetSection({
    budgetConfig,
    currency,
}: {
    budgetConfig: BudgetConfigItem[] | null;
    currency: string;
}) {
    const { t } = useTranslation();
    const title = t("campaigns.details.config.budget.title");

    if (!budgetConfig || budgetConfig.length === 0) {
        return (
            <Section title={title}>
                <Card radius="m">
                    <Text variant="bodySmall" color="secondary">
                        {t("campaigns.details.config.budget.none")}
                    </Text>
                </Card>
            </Section>
        );
    }

    return (
        <Section title={title}>
            <Card radius="m">
                <div>
                    {budgetConfig.map((item, index) => (
                        <DefinitionRow
                            key={`${item.label}-${index}`}
                            label={t(
                                `campaigns.details.config.budget.period.${budgetPeriodKey(item.durationInSeconds)}`
                            )}
                        >
                            <ValueText>
                                {item.amount} {currency}
                            </ValueText>
                        </DefinitionRow>
                    ))}
                </div>
            </Card>
        </Section>
    );
}

/* ------------------------------------------------------------------ */
/* Targeting                                                           */
/* ------------------------------------------------------------------ */

function TargetingSection({ metadata }: { metadata: CampaignMetadata | null }) {
    const { t } = useTranslation();
    const goal = metadata?.goal;
    const territories = metadata?.territories ?? [];
    const specialCategories = metadata?.specialCategories ?? [];

    if (!goal && territories.length === 0 && specialCategories.length === 0) {
        return null;
    }

    return (
        <Section title={t("campaigns.details.config.targeting.title")}>
            <Card radius="m">
                <div>
                    {goal && (
                        <DefinitionRow
                            label={t("campaigns.details.config.targeting.goal")}
                        >
                            <ValueText>
                                {t(
                                    `campaigns.details.config.targeting.goalValue.${goal}`
                                )}
                            </ValueText>
                        </DefinitionRow>
                    )}
                    <DefinitionRow
                        label={t(
                            "campaigns.details.config.targeting.territories"
                        )}
                    >
                        {territories.length === 0 ? (
                            <ValueText>
                                {t(
                                    "campaigns.details.config.targeting.allTerritories"
                                )}
                            </ValueText>
                        ) : (
                            territories.map((country) => (
                                <Badge
                                    key={country}
                                    variant="neutral"
                                    size="small"
                                >
                                    {country}
                                </Badge>
                            ))
                        )}
                    </DefinitionRow>
                    {specialCategories.length > 0 && (
                        <DefinitionRow
                            label={t(
                                "campaigns.details.config.targeting.specialCategories"
                            )}
                        >
                            {specialCategories.map((category) => (
                                <Badge
                                    key={category}
                                    variant="warning"
                                    size="small"
                                >
                                    {t(
                                        `campaigns.details.config.targeting.specialCategoryValue.${category}`
                                    )}
                                </Badge>
                            ))}
                        </DefinitionRow>
                    )}
                </div>
            </Card>
        </Section>
    );
}

/* ------------------------------------------------------------------ */
/* Schedule                                                            */
/* ------------------------------------------------------------------ */

function ScheduleSection({ campaign }: { campaign: Campaign }) {
    const { t } = useTranslation();

    return (
        <Section title={t("campaigns.details.config.schedule.title")}>
            <Card radius="m">
                <div>
                    <DefinitionRow
                        label={t("campaigns.details.config.schedule.published")}
                    >
                        <ValueText>
                            {campaign.publishedAt
                                ? formatDate(new Date(campaign.publishedAt))
                                : t(
                                      "campaigns.details.config.schedule.notPublished"
                                  )}
                        </ValueText>
                    </DefinitionRow>
                    <DefinitionRow
                        label={t("campaigns.details.config.schedule.expires")}
                    >
                        <ValueText>
                            {campaign.expiresAt
                                ? formatDate(new Date(campaign.expiresAt))
                                : t(
                                      "campaigns.details.config.schedule.noExpiration"
                                  )}
                        </ValueText>
                    </DefinitionRow>
                </div>
            </Card>
        </Section>
    );
}
