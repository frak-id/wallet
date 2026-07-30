import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CartIcon,
    CommunityIcon,
    PencilIcon,
    ShareIcon,
    SparklesIcon,
} from "@frak-labs/design-system/icons";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCampaignCurrencyGlyph } from "@/module/campaigns/hook/useCampaignCurrencyGlyph";
import { useUpdateCampaignConfig } from "@/module/campaigns/hook/useUpdateCampaignConfig";
import { campaignQueryOptions } from "@/module/campaigns/queries/queryOptions";
import {
    BUDGET_TYPE_LABEL,
    type BudgetType,
    budgetTypeFromDuration,
    getCapPeriod,
} from "@/module/campaigns/utils/capPeriods";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { DateField } from "@/module/common/component/DateField";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { formatDate } from "@/module/common/utils/formatDate";
import { getNumberFormat } from "@/module/common/utils/intlCache";
import { Input } from "@/module/forms/Input";
import { useReadOnlyMerchant } from "@/module/merchant/hook/useReadOnlyMerchant";
import { getStartDate, PRODUCT_SCOPE_FIELDS } from "@/stores/campaignStore";
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
    const { data: campaign, isPending } = useQuery(
        campaignQueryOptions({ merchantId, campaignId, isDemoMode })
    );

    if (isPending) {
        return <Skeleton variant="rect" height={320} />;
    }

    if (!campaign) {
        return null;
    }

    return <ConfigContent campaign={campaign} />;
}

// Start/end date and budget are editable on a live campaign (the ruleset stays
// locked). Platform admins viewing a merchant are read-only.
function canEditLiveCampaign(campaign: Campaign, isReadOnly: boolean): boolean {
    return (
        !isReadOnly &&
        (campaign.status === "active" || campaign.status === "paused")
    );
}

function ConfigContent({ campaign }: { campaign: Campaign }) {
    const currency = currencyStore((s) => s.preferredCurrency).toUpperCase();
    const merchantId = useActiveMerchantId();
    const isReadOnly = useReadOnlyMerchant({ merchantId });
    const { rule, metadata } = campaign;
    const canEdit = canEditLiveCampaign(campaign, isReadOnly);

    return (
        <Stack space="l">
            <TriggerSection trigger={rule.trigger} />
            <ProductScopeSection productScope={rule.productScope} />
            <RewardsSection rewards={rule.rewards} currency={currency} />
            <ConditionsSection conditions={rule.conditions} />
            <LimitsSection rule={rule} />
            <BudgetSection
                campaign={campaign}
                currency={currency}
                merchantId={merchantId}
                canEdit={canEdit}
            />
            <TargetingSection metadata={metadata} />
            <ScheduleSection
                campaign={campaign}
                merchantId={merchantId}
                canEdit={canEdit}
            />
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

/** Small, subtle pencil affordance shown next to an editable section title. */
function EditPencilButton({
    onClick,
    label,
}: {
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={styles.editIconButton}
        >
            <PencilIcon width={16} height={16} />
        </button>
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

// `in`/`not_in` carry a list of operands; every other operator a single one.
function formatConditionValue(
    value: string | number | boolean | (string | number | boolean)[] | null
): string {
    if (value === null) return "∅";
    if (Array.isArray(value)) return value.map(formatConditionValue).join(", ");
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
}

function humanizeField(field: string): string {
    return field.replace(/\./g, " › ");
}

/** Scope fields with a translated label; anything else renders raw. */
const PRODUCT_SCOPE_FIELD_KEYS = new Set<string>(PRODUCT_SCOPE_FIELDS);

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
                            key={`group-${condition.logic}-${index}`}
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

/* ------------------------------------------------------------------ */
/* Product scope                                                       */
/* ------------------------------------------------------------------ */

/**
 * Which cart line items the campaign covers. Unlike order-level conditions,
 * `productScope` fields are item-relative (`sku`, not `purchase.items.sku`),
 * so they get their own translated field labels rather than the raw
 * dot-path humanisation used for conditions.
 */
function ProductScopeChip({ condition }: { condition: RuleCondition }) {
    const { t } = useTranslation();
    const operator = operatorLabels[condition.operator] ?? condition.operator;
    // Unknown fields can only come from a rule authored outside the app; fall
    // back to the raw name rather than render a missing translation key.
    const field = PRODUCT_SCOPE_FIELD_KEYS.has(condition.field)
        ? t(
              `campaigns.create.products.field.${condition.field}` as "campaigns.create.products.field.sku"
          )
        : condition.field;

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

function ProductScopeNodes({ scope }: { scope: RuleConditions }) {
    const { t } = useTranslation();
    const nodes = Array.isArray(scope) ? scope : scope.conditions;

    return (
        <Stack space="xs">
            {!Array.isArray(scope) && (
                <Text variant="caption" color="tertiary">
                    {scope.logic === "all"
                        ? t("campaigns.details.config.conditions.all")
                        : scope.logic === "any"
                          ? t("campaigns.details.config.conditions.any")
                          : t("campaigns.details.config.conditions.noneOf")}
                </Text>
            )}
            <div className={styles.tagRow}>
                {nodes.map((node, index) =>
                    isConditionGroup(node) ? (
                        <ProductScopeNodes
                            key={`group-${node.logic}-${index}`}
                            scope={node}
                        />
                    ) : (
                        <ProductScopeChip
                            key={`${node.field}-${index}`}
                            condition={node}
                        />
                    )
                )}
            </div>
        </Stack>
    );
}

function ProductScopeSection({
    productScope,
}: {
    productScope?: RuleConditions;
}) {
    const { t } = useTranslation();

    return (
        <Section title={t("campaigns.details.config.productScope.title")}>
            <Card radius="m">
                {!productScope || isConditionsEmpty(productScope) ? (
                    <Text variant="bodySmall" color="secondary">
                        {t("campaigns.details.config.productScope.all")}
                    </Text>
                ) : (
                    <Stack space="s">
                        <Text variant="bodySmall" color="secondary">
                            {t(
                                "campaigns.details.config.productScope.description"
                            )}
                        </Text>
                        <ProductScopeNodes scope={productScope} />
                    </Stack>
                )}
            </Card>
        </Section>
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
        getNumberFormat(locale, {
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

const BUDGET_PERIODS: BudgetType[] = ["global", "daily", "weekly", "monthly"];

function BudgetRows({
    budgetConfig,
    currency,
}: {
    budgetConfig: BudgetConfigItem[] | null;
    currency: string;
}) {
    const { t } = useTranslation();
    if (!budgetConfig || budgetConfig.length === 0) {
        return (
            <Text variant="bodySmall" color="secondary">
                {t("campaigns.details.config.budget.none")}
            </Text>
        );
    }
    return (
        <div>
            {budgetConfig.map((item, index) => (
                <DefinitionRow
                    key={`${item.label}-${index}`}
                    label={t(
                        `campaigns.details.config.budget.period.${budgetTypeFromDuration(item.durationInSeconds)}`
                    )}
                >
                    <ValueText>
                        {item.amount} {currency}
                    </ValueText>
                </DefinitionRow>
            ))}
        </div>
    );
}

function BudgetSection({
    campaign,
    currency,
    merchantId,
    canEdit,
}: {
    campaign: Campaign;
    currency: string;
    merchantId: string;
    canEdit: boolean;
}) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const title = t("campaigns.details.config.budget.title");

    return (
        <Section
            title={title}
            action={
                canEdit && !isEditing ? (
                    <EditPencilButton
                        onClick={() => setIsEditing(true)}
                        label={t("campaigns.details.config.budget.edit")}
                    />
                ) : undefined
            }
        >
            <Card radius="m">
                {isEditing ? (
                    <BudgetEditor
                        campaign={campaign}
                        merchantId={merchantId}
                        currency={currency}
                        onClose={() => setIsEditing(false)}
                    />
                ) : (
                    <BudgetRows
                        budgetConfig={campaign.budgetConfig}
                        currency={currency}
                    />
                )}
            </Card>
        </Section>
    );
}

function BudgetEditor({
    campaign,
    merchantId,
    currency,
    onClose,
}: {
    campaign: Campaign;
    merchantId: string;
    currency: string;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const { mutateAsync, isPending, isError } = useUpdateCampaignConfig();
    const currencyGlyph = useCampaignCurrencyGlyph();
    // The app only ever authors a single budget cap, so the editor reads/writes
    // `budgetConfig[0]`. If multi-cap campaigns are ever introduced this editor
    // must grow a row per cap to avoid dropping the others.
    const existing = campaign.budgetConfig?.[0];
    const [period, setPeriod] = useState<BudgetType>(
        budgetTypeFromDuration(existing?.durationInSeconds)
    );
    const [amount, setAmount] = useState<number>(existing?.amount ?? 0);
    const invalid = !(amount > 0);

    async function onSave() {
        if (invalid) return;
        await mutateAsync({
            merchantId,
            campaignId: campaign.id,
            campaign,
            budgetConfig: [
                {
                    label: BUDGET_TYPE_LABEL[period],
                    durationInSeconds: getCapPeriod(period),
                    amount,
                },
            ],
        });
        onClose();
    }

    return (
        <Stack space="s">
            <BudgetRows
                budgetConfig={campaign.budgetConfig}
                currency={currency}
            />
            <div className={styles.editDivider} />
            <Stack space="xs">
                <Text as="span" variant="bodySmall" color="secondary">
                    {t("campaigns.details.config.budget.periodLabel")}
                </Text>
                <RadioGroup
                    value={period}
                    onValueChange={(value) => setPeriod(value as BudgetType)}
                >
                    <Stack space="xs">
                        {BUDGET_PERIODS.map((p) => (
                            <label
                                key={p}
                                htmlFor={`budget-period-${p}`}
                                className={styles.budgetPeriodOption}
                            >
                                <RadioGroupItem
                                    id={`budget-period-${p}`}
                                    value={p}
                                    size="l"
                                    disabled={isPending}
                                />
                                <Text as="span" variant="bodySmall">
                                    {t(`campaigns.create.budget.period.${p}`)}
                                </Text>
                            </label>
                        ))}
                    </Stack>
                </RadioGroup>
            </Stack>
            <Stack space="xs">
                <Text as="span" variant="bodySmall" color="secondary">
                    {t("campaigns.details.config.budget.amountLabel")}
                </Text>
                <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={amount || ""}
                    onChange={(event) => {
                        const next = event.target.valueAsNumber;
                        setAmount(Number.isNaN(next) ? 0 : next);
                    }}
                    error={invalid}
                    disabled={isPending}
                    rightSection={<span>{currencyGlyph}</span>}
                    aria-label={t(
                        "campaigns.details.config.budget.amountLabel"
                    )}
                />
            </Stack>
            {isError && (
                <Text as="span" variant="bodySmall" color="error">
                    {t("campaigns.details.config.budget.error")}
                </Text>
            )}
            <Inline space="xs">
                <Button
                    variant="secondary"
                    onClick={onClose}
                    disabled={isPending}
                >
                    {t("campaigns.details.config.budget.cancel")}
                </Button>
                <Button
                    variant="primary"
                    loading={isPending}
                    disabled={isPending || invalid}
                    onClick={onSave}
                >
                    {t("campaigns.details.config.budget.save")}
                </Button>
            </Inline>
        </Stack>
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

function ScheduleRows({
    campaign,
    startDate,
}: {
    campaign: Campaign;
    startDate: string | undefined;
}) {
    const { t } = useTranslation();
    return (
        <div>
            <DefinitionRow
                label={t("campaigns.details.config.schedule.starts")}
            >
                <ValueText>
                    {startDate
                        ? formatDate(new Date(startDate))
                        : t("campaigns.details.config.schedule.immediate")}
                </ValueText>
            </DefinitionRow>
            <DefinitionRow
                label={t("campaigns.details.config.schedule.published")}
            >
                <ValueText>
                    {campaign.publishedAt
                        ? formatDate(new Date(campaign.publishedAt))
                        : t("campaigns.details.config.schedule.notPublished")}
                </ValueText>
            </DefinitionRow>
            <DefinitionRow
                label={t("campaigns.details.config.schedule.expires")}
            >
                <ValueText>
                    {campaign.expiresAt
                        ? formatDate(new Date(campaign.expiresAt))
                        : t("campaigns.details.config.schedule.noExpiration")}
                </ValueText>
            </DefinitionRow>
        </div>
    );
}

function ScheduleSection({
    campaign,
    merchantId,
    canEdit,
}: {
    campaign: Campaign;
    merchantId: string;
    canEdit: boolean;
}) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const startDate = getStartDate(campaign.rule);

    return (
        <Section
            title={t("campaigns.details.config.schedule.title")}
            action={
                canEdit && !isEditing ? (
                    <EditPencilButton
                        onClick={() => setIsEditing(true)}
                        label={t("campaigns.details.config.schedule.edit")}
                    />
                ) : undefined
            }
        >
            <Card radius="m">
                {isEditing ? (
                    <ScheduleEditor
                        campaign={campaign}
                        merchantId={merchantId}
                        startDate={startDate}
                        onClose={() => setIsEditing(false)}
                    />
                ) : (
                    <ScheduleRows campaign={campaign} startDate={startDate} />
                )}
            </Card>
        </Section>
    );
}

function ScheduleEditor({
    campaign,
    merchantId,
    startDate: currentStart,
    onClose,
}: {
    campaign: Campaign;
    merchantId: string;
    startDate: string | undefined;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const { mutateAsync, isPending, isError } = useUpdateCampaignConfig();
    const currentEnd = campaign.expiresAt ?? undefined;
    const [start, setStart] = useState<string | undefined>(currentStart);
    const [end, setEnd] = useState<string | undefined>(currentEnd);

    const today = useMemo(() => startOfDay(new Date()), []);
    // Forward-only: the start can't be pulled before today, nor before an
    // existing future start.
    const minStart =
        currentStart && new Date(currentStart) > today
            ? new Date(currentStart)
            : today;
    const minEnd = start ? new Date(start) : today;
    // End must be strictly after start (no zero-duration campaign).
    const endBeforeStart = Boolean(
        start && end && new Date(end) <= new Date(start)
    );

    async function onSave() {
        if (endBeforeStart) return;
        // Only send fields that actually changed. Notably, if the user blanks a
        // start that was previously set we leave it untouched (undefined) rather
        // than sending `null` — the backend forbids clearing/rewinding the start
        // gate on a live campaign, and "leave as-is" is the sane intent here.
        const startChanged = start !== currentStart && start !== undefined;
        const endChanged = end !== currentEnd;
        await mutateAsync({
            merchantId,
            campaignId: campaign.id,
            campaign,
            ...(startChanged ? { startDate: start } : {}),
            ...(endChanged ? { expiresAt: end ?? null } : {}),
        });
        onClose();
    }

    return (
        <Stack space="s">
            <ScheduleRows campaign={campaign} startDate={currentStart} />
            <div className={styles.editDivider} />
            <Stack space="xs">
                <Text as="span" variant="bodySmall" color="secondary">
                    {t("campaigns.details.config.schedule.starts")}
                </Text>
                <DateField
                    value={start}
                    onChange={setStart}
                    minDate={minStart}
                    ariaLabel={t("campaigns.details.config.schedule.starts")}
                    disabled={isPending}
                />
            </Stack>
            <Stack space="xs">
                <Text as="span" variant="bodySmall" color="secondary">
                    {t("campaigns.details.config.schedule.expires")}
                </Text>
                <DateField
                    value={end}
                    onChange={setEnd}
                    minDate={minEnd}
                    ariaLabel={t("campaigns.details.config.schedule.expires")}
                    disabled={isPending}
                    error={endBeforeStart}
                    errorMessage={t(
                        "campaigns.details.config.schedule.endBeforeStart"
                    )}
                />
            </Stack>
            {isError && (
                <Text as="span" variant="bodySmall" color="error">
                    {t("campaigns.details.config.schedule.error")}
                </Text>
            )}
            <Inline space="xs">
                <Button
                    variant="secondary"
                    onClick={onClose}
                    disabled={isPending}
                >
                    {t("campaigns.details.config.schedule.cancel")}
                </Button>
                <Button
                    variant="primary"
                    loading={isPending}
                    disabled={isPending || endBeforeStart}
                    onClick={onSave}
                >
                    {t("campaigns.details.config.schedule.save")}
                </Button>
            </Inline>
        </Stack>
    );
}
