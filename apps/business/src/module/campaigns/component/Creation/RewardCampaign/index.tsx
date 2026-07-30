import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { FieldLabel } from "@frak-labs/design-system/components/FieldLabel";
import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ArrowRightIcon,
    CheckFilledIcon,
    DeleteIcon,
    DoubleChevronIcon,
    LightbulbIcon,
    PercentIcon,
    PlusIcon,
} from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { createContext, Fragment, type ReactNode, use, useMemo } from "react";
import {
    type Control,
    Controller,
    type ControllerRenderProps,
    type UseFormSetValue,
    useFieldArray,
    useForm,
    useFormState,
    useWatch,
} from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { useCampaignCurrencyGlyph } from "@/module/campaigns/hook/useCampaignCurrencyGlyph";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Button } from "@/module/common/component/Button";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { InputNumber } from "@/module/forms/InputNumber";
import { campaignStore } from "@/stores/campaignStore";
import { DistributionBar } from "../DistributionBar";
import { InfoBanner } from "../InfoBanner";
import { WizardFieldCard } from "../WizardFieldCard";
import { WizardStep } from "../WizardStep";
import * as rows from "../wizardRows.css";
import * as styles from "./reward.css";
import {
    type CpaTierRow,
    DEFAULT_REWARD_FORM,
    draftToRewardForm,
    isRewardFormValid,
    type RewardFormValues,
    type RewardModel,
    recalcCpaFromSplit,
    recalcSplitOnCpaChange,
    recommendedSplit,
    requiresMatchedBasis,
    rewardFormToDraft,
    splitTargetCpa,
    supportsMatchedBasis,
    tieredRangesOverlap,
} from "./utils";

const FORM_ID = "campaign-reward-form";

type UnitKind = "amount" | "percent";

/** Reward-currency glyph (€/£/$) for `"amount"` units, shared across the step. */
const CurrencyGlyphContext = createContext<string>("€");
const useCurrencyGlyph = () => use(CurrencyGlyphContext);

const MODELS = [
    {
        value: "fixed",
        titleKey: "campaigns.create.reward.model.fixed.title",
        descKey: "campaigns.create.reward.model.fixed.description",
    },
    {
        value: "percentage",
        titleKey: "campaigns.create.reward.model.percentage.title",
        descKey: "campaigns.create.reward.model.percentage.description",
    },
    {
        value: "tiered",
        titleKey: "campaigns.create.reward.model.tiered.title",
        descKey: "campaigns.create.reward.model.tiered.description",
    },
] as const satisfies ReadonlyArray<{
    value: RewardModel;
    titleKey: string;
    descKey: string;
}>;

/* ------------------------------------------------------------------ */
/*  Shared field bits                                                  */
/* ------------------------------------------------------------------ */

function UnitIcon({ unit }: { unit: UnitKind }) {
    const glyph = useCurrencyGlyph();
    if (unit === "percent") {
        return (
            <PercentIcon width={24} height={24} className={styles.unitIcon} />
        );
    }
    return <span className={styles.unitGlyph}>{glyph}</span>;
}

/** Double-chevron stepper: one glyph with two transparent hit zones. */
function NumberStepper({
    value,
    onChange,
    step = 1,
}: {
    value: number | string;
    onChange: (next: number) => void;
    step?: number;
}) {
    const current = typeof value === "number" ? value : Number(value) || 0;
    return (
        <span className={styles.stepper}>
            <DoubleChevronIcon
                width={24}
                height={24}
                className={styles.stepperIcon}
            />
            <button
                type="button"
                tabIndex={-1}
                aria-label="increment"
                className={styles.stepperUp}
                onClick={() => onChange(current + step)}
            />
            <button
                type="button"
                tabIndex={-1}
                aria-label="decrement"
                className={styles.stepperDown}
                onClick={() => onChange(Math.max(0, current - step))}
            />
        </span>
    );
}

/** The numeric, single-value fields the stepper input is used for. */
type NumericFieldName =
    | "targetCpa"
    | "ambassadorAmount"
    | "refereeAmount"
    | "targetCpaPercent"
    | "ambassadorPercent"
    | "refereePercent"
    | "minPurchaseAmount"
    | "lockupDays";

type StepperFieldProps = {
    field: ControllerRenderProps<RewardFormValues, NumericFieldName>;
    /** A glyph unit (€ / %). Use `unitLabel` instead for word units. */
    unit?: UnitKind;
    /** A localised text unit (e.g. "DAYS"/"JOURS"); a word can't be a glyph. */
    unitLabel?: string;
    placeholder: string;
    /**
     * Accessible name when there's no visible composed `label`. Required
     * unless `label` is set (see below).
     */
    ariaLabel?: string;
    /**
     * Composed label rendered above the control. When set, it
     * owns the accessible name via `htmlFor`↔`id` — `ariaLabel` is dropped.
     */
    label?: ReactNode;
    /** Composed hint rendered below the control, linked via `aria-describedby`. */
    hint?: ReactNode;
    /** "muted" = grey filled (default), "elevated" = white. */
    tone?: "muted" | "elevated";
    /** Keep a literal `0` visible (e.g. min-purchase/lockup, where 0 is valid). */
    allowZero?: boolean;
    /** Fill the field with the error surface when invalid. */
    error?: boolean;
    /** Native input `step` (e.g. `0.01` to allow 2-decimal entry). */
    step?: number | string;
};

/** A numeric field with a double-chevron stepper and a trailing unit. */
function StepperField({
    field,
    unit,
    unitLabel,
    placeholder,
    ariaLabel,
    label,
    hint,
    tone = "muted",
    allowZero = false,
    error,
    step,
}: StepperFieldProps) {
    return (
        <InputNumber
            variant="bare"
            tone={tone}
            error={error}
            step={step}
            aria-label={label ? undefined : ariaLabel}
            label={label}
            hint={hint}
            classNameWrapper={styles.inputWrapper}
            placeholder={placeholder}
            rightSection={
                <Inline as="span" space="m" alignY="center">
                    <NumberStepper
                        value={field.value ?? 0}
                        onChange={field.onChange}
                    />
                    {unitLabel ? (
                        <span className={styles.unitText}>{unitLabel}</span>
                    ) : unit ? (
                        <UnitIcon unit={unit} />
                    ) : null}
                </Inline>
            }
            {...field}
            value={allowZero ? (field.value ?? "") : field.value || ""}
        />
    );
}

function TriggeredRow() {
    const { t } = useTranslation();
    const trigger = campaignStore((s) => s.draft.rule.trigger);
    return (
        <Inline space="xs" alignY="center">
            <CheckFilledIcon
                width={12}
                height={12}
                className={styles.triggeredIcon}
            />
            <Text variant="caption" color="primary">
                {t("campaigns.create.reward.triggeredOn", {
                    trigger: t(`campaigns.create.reward.trigger.${trigger}`),
                })}
            </Text>
        </Inline>
    );
}

/** The blue "Frak recommends 80/20" bar with an Apply-reco button. */
function RecoBar({ onApply }: { onApply: () => void }) {
    const { t } = useTranslation();
    return (
        <div className={styles.recoBar}>
            <LightbulbIcon width={24} height={24} className={styles.recoIcon} />
            <Text
                variant="bodySmall"
                color="primary"
                className={styles.recoText}
            >
                <Trans
                    i18nKey="campaigns.create.reward.cpa.reco"
                    components={{
                        highlight: <span className={styles.recoHighlight} />,
                    }}
                />
            </Text>
            <Button
                type="button"
                variant="primary"
                size="small"
                onClick={onApply}
            >
                {t("campaigns.create.reward.cpa.applyReco")}
            </Button>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Campaign type                                                      */
/* ------------------------------------------------------------------ */

function CampaignTypeField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <div className={styles.referralRow}>
            <span className={styles.referralMain}>
                <Text variant="body" weight="medium">
                    {t("campaigns.create.reward.campaignType.referral.title")}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t(
                        "campaigns.create.reward.campaignType.referral.description"
                    )}
                </Text>
            </span>
            <Controller
                control={control}
                name="referralOnly"
                render={({ field }) => (
                    <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                    />
                )}
            />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Reward model + reveals                                             */
/* ------------------------------------------------------------------ */

function RevealHeader() {
    const { t } = useTranslation();
    return (
        <Stack space="xxs">
            <Text variant="bodySmall" weight="medium" color="secondary">
                {t("campaigns.create.reward.value.label")}
            </Text>
            <Text variant="caption" color="tertiary">
                {t("campaigns.create.reward.value.description")}
            </Text>
        </Stack>
    );
}

// Exported for unit testing.
export function RecipientBox({
    control,
    name,
    label,
    unit,
    placeholder,
    hint,
    error,
    step,
    onChangeExtra,
}: {
    control: Control<RewardFormValues>;
    name:
        | "ambassadorAmount"
        | "refereeAmount"
        | "ambassadorPercent"
        | "refereePercent";
    label: string;
    unit: UnitKind;
    placeholder: string;
    /** Omitted (e.g. while the input is empty) ⇒ no hint line is rendered. */
    hint?: string;
    /** Tint the input red when the split is invalid. */
    error?: boolean;
    /** Native input `step` (e.g. `0.01` to allow 2-decimal entry). */
    step?: number | string;
    /** Runs after the field update (e.g. to re-derive the Target CPA). */
    onChangeExtra?: (next: number | "") => void;
}) {
    return (
        <div className={styles.recipientBox}>
            <Controller
                control={control}
                name={name}
                render={({ field }) => (
                    <StepperField
                        field={{
                            ...field,
                            onChange: (next) => {
                                field.onChange(next);
                                onChangeExtra?.(next as number | "");
                            },
                        }}
                        unit={unit}
                        tone="elevated"
                        error={error}
                        step={step}
                        placeholder={placeholder}
                        label={label}
                        hint={hint}
                    />
                )}
            />
        </div>
    );
}

/**
 * Shared Target-CPA reveal for the Fixed (€) and % models: a Target CPA input,
 * an 80/20 distribution bar, a gated reco bar, and the Ambassador/Referee
 * split inputs. The unit (€ vs %) and field names are passed per model.
 */
// Cleared inputs become "" (not 0); coerce so the empty checks hold.
const num = (v: number | string | undefined) => (typeof v === "number" ? v : 0);

// Exported for unit testing.
export function CpaReveal({
    control,
    setValue,
    unit,
    cpaName,
    ambName,
    refName,
    cpaLabel,
    cpaPlaceholder,
    ambPlaceholder,
    refPlaceholder,
    recipientHint,
    hintWhenEmpty = false,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    unit: "amount" | "percent";
    cpaName: "targetCpa" | "targetCpaPercent";
    ambName: "ambassadorAmount" | "ambassadorPercent";
    refName: "refereeAmount" | "refereePercent";
    cpaLabel: string;
    cpaPlaceholder: string;
    ambPlaceholder: string;
    refPlaceholder: string;
    /** Hint under each recipient input, given its share of the pool. */
    recipientHint: (poolPercent: number) => string;
    /** Show the hint even while the input is empty (the % model's static hint). */
    hintWhenEmpty?: boolean;
}) {
    const { t } = useTranslation();
    const cpa = num(useWatch({ control, name: cpaName }));
    const ambassador = num(useWatch({ control, name: ambName }));
    const referee = num(useWatch({ control, name: refName }));
    const { rewardsPool, frakCommission } = splitTargetCpa(cpa);
    const hasPool = rewardsPool > 0;
    const glyph = useCurrencyGlyph();
    const suffix = unit === "amount" ? glyph : "%";

    // Reco shows only while no split has been configured yet.
    const showReco = hasPool && ambassador === 0 && referee === 0;

    // The split must allocate the whole pool; flag any over/under allocation.
    const splitSum = ambassador + referee;
    const splitMismatch =
        hasPool && splitSum > 0 && Math.abs(splitSum - rewardsPool) >= 0.01;

    const poolPercent = (value: number) =>
        hasPool ? Math.round((value / rewardsPool) * 100) : 0;

    function applyReco() {
        const reco = recommendedSplit(cpa);
        setValue(ambName, reco.ambassador, { shouldValidate: true });
        setValue(refName, reco.referee, { shouldValidate: true });
    }

    // Editing a recipient reward makes the split the source of truth: re-derive
    // the Target CPA (pool ÷ rewards-share, to the cent) so the two stay in sync.
    function syncCpaFromSplit(nextAmbassador: number, nextReferee: number) {
        setValue(cpaName, recalcCpaFromSplit(nextAmbassador, nextReferee), {
            shouldValidate: true,
        });
    }

    return (
        <Stack space="m">
            <RevealHeader />

            <Controller
                control={control}
                name={cpaName}
                render={({ field }) => (
                    <StepperField
                        field={{
                            ...field,
                            // Changing the Target CPA changes the pool. If
                            // the split is still the untouched reco, keep it
                            // in sync by recomputing it for the new CPA. If
                            // the user edited the amounts, leave them — the
                            // mismatch warning + Continue gating flag it.
                            onChange: (next) => {
                                field.onChange(next);
                                const reco = recalcSplitOnCpaChange({
                                    prevCpa: cpa,
                                    nextCpa: num(next),
                                    ambassador,
                                    referee,
                                });
                                if (reco) {
                                    setValue(ambName, reco.ambassador, {
                                        shouldValidate: true,
                                    });
                                    setValue(refName, reco.referee, {
                                        shouldValidate: true,
                                    });
                                }
                            },
                        }}
                        unit={unit}
                        step={0.01}
                        placeholder={cpaPlaceholder}
                        label={cpaLabel}
                        hint={t("campaigns.create.reward.cpa.hint")}
                    />
                )}
            />

            <div className={styles.distributionGap}>
                <DistributionBar
                    rewardsLabel={t(
                        "campaigns.create.reward.cpa.rewardsDistributed"
                    )}
                    commissionLabel={t(
                        "campaigns.create.reward.cpa.frakCommission"
                    )}
                    rewardsAmount={rewardsPool}
                    commissionAmount={frakCommission}
                    suffix={suffix}
                />
            </div>

            {showReco && <RecoBar onApply={applyReco} />}

            {hasPool && (
                <div className={styles.recipientGrid}>
                    <RecipientBox
                        control={control}
                        name={ambName}
                        label={t(
                            "campaigns.create.reward.recipient.ambassadorReward"
                        )}
                        unit={unit}
                        step={0.01}
                        placeholder={ambPlaceholder}
                        error={splitMismatch}
                        onChangeExtra={(next) =>
                            syncCpaFromSplit(num(next), referee)
                        }
                        hint={
                            hintWhenEmpty || ambassador > 0
                                ? recipientHint(poolPercent(ambassador))
                                : undefined
                        }
                    />
                    <RecipientBox
                        control={control}
                        name={refName}
                        label={t(
                            "campaigns.create.reward.recipient.refereeReward"
                        )}
                        unit={unit}
                        step={0.01}
                        placeholder={refPlaceholder}
                        error={splitMismatch}
                        onChangeExtra={(next) =>
                            syncCpaFromSplit(ambassador, num(next))
                        }
                        hint={
                            hintWhenEmpty || referee > 0
                                ? recipientHint(poolPercent(referee))
                                : undefined
                        }
                    />
                </div>
            )}

            {splitMismatch && (
                <FieldError>
                    {t("campaigns.create.reward.cpa.splitMismatch", {
                        amount: `${rewardsPool}${suffix}`,
                    })}
                </FieldError>
            )}

            <TriggeredRow />
        </Stack>
    );
}

function FixedReveal({
    control,
    setValue,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <CpaReveal
            control={control}
            setValue={setValue}
            unit="amount"
            cpaName="targetCpa"
            ambName="ambassadorAmount"
            refName="refereeAmount"
            cpaLabel={t("campaigns.create.reward.fixed.cpaLabel")}
            cpaPlaceholder={t("campaigns.create.reward.fixed.cpaPlaceholder")}
            ambPlaceholder={t(
                "campaigns.create.reward.recipient.ambassadorPlaceholder"
            )}
            refPlaceholder={t(
                "campaigns.create.reward.recipient.refereePlaceholder"
            )}
            recipientHint={(percent) =>
                t("campaigns.create.reward.fixed.percentOfPool", { percent })
            }
        />
    );
}

function PercentageReveal({
    control,
    setValue,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <CpaReveal
            control={control}
            setValue={setValue}
            unit="percent"
            cpaName="targetCpaPercent"
            ambName="ambassadorPercent"
            refName="refereePercent"
            cpaLabel={t("campaigns.create.reward.percentage.cpaLabel")}
            cpaPlaceholder={t(
                "campaigns.create.reward.percentage.cpaPlaceholder"
            )}
            ambPlaceholder={t(
                "campaigns.create.reward.recipient.ambassadorPlaceholder"
            )}
            refPlaceholder={t(
                "campaigns.create.reward.recipient.refereePlaceholder"
            )}
            recipientHint={() =>
                t("campaigns.create.reward.percentage.recipientHint")
            }
            hintWhenEmpty
        />
    );
}

/* ------------------------------------------------------------------ */
/*  Tiered (static)                                                    */
/* ------------------------------------------------------------------ */

/** Unit (€/%) Select, restyled as a grey filled 56px field. */
function UnitSelectField({
    control,
    name,
    tone = "muted",
    disabled,
}: {
    control: Control<RewardFormValues>;
    name: string;
    tone?: "muted" | "elevated";
    disabled?: boolean;
}) {
    const glyph = useCurrencyGlyph();
    return (
        <Controller
            control={control}
            // biome-ignore lint/suspicious/noExplicitAny: dynamic field-array path
            name={name as any}
            render={({ field }) => (
                <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                >
                    <SelectTrigger
                        className={
                            tone === "elevated"
                                ? styles.unitTriggerElevated
                                : styles.unitTrigger
                        }
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">{glyph}</SelectItem>
                    </SelectContent>
                </Select>
            )}
        />
    );
}

/**
 * A filled tier input with a trailing unit glyph. With `stepper`, a
 * double-chevron stepper precedes the glyph (Target CPA / reward fields); the
 * basket-range fields omit it.
 */
function TierCell({
    control,
    name,
    placeholder,
    unit,
    tone = "muted",
    error,
    stepper = false,
    step,
    onChangeExtra,
}: {
    control: Control<RewardFormValues>;
    name: string;
    placeholder: string;
    unit: UnitKind;
    tone?: "muted" | "elevated";
    error?: boolean;
    stepper?: boolean;
    /** Native input `step` (e.g. `0.01` to allow 2-decimal entry). */
    step?: number | string;
    /** Runs after the field update (e.g. the CPA cell re-recommends the split). */
    onChangeExtra?: (next: number | "") => void;
}) {
    return (
        <Controller
            control={control}
            // biome-ignore lint/suspicious/noExplicitAny: dynamic field-array path
            name={name as any}
            render={({ field }) => {
                const handleChange: typeof field.onChange = (next) => {
                    field.onChange(next);
                    onChangeExtra?.(next as number | "");
                };
                return (
                    <InputNumber
                        variant="bare"
                        tone={tone}
                        error={error}
                        step={step}
                        classNameWrapper={styles.inputWrapper}
                        placeholder={placeholder}
                        rightSection={
                            stepper ? (
                                <Inline as="span" space="m" alignY="center">
                                    <NumberStepper
                                        value={field.value ?? 0}
                                        onChange={handleChange}
                                    />
                                    <UnitIcon unit={unit} />
                                </Inline>
                            ) : (
                                <UnitIcon unit={unit} />
                            )
                        }
                        {...field}
                        onChange={handleChange}
                        value={field.value ?? ""}
                    />
                );
            }}
        />
    );
}

/** A delete (trash) button on a tier's title row (rendered for tier 2+). */
function TierDelete({
    onRemove,
    label,
}: {
    onRemove: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            className={styles.tierDelete}
            aria-label={label}
            onClick={onRemove}
        >
            <DeleteIcon width={24} height={24} />
        </button>
    );
}

// Exported for unit testing.
/** A labelled field column (label above the input). */
export function TierField({
    label,
    className,
    padding,
    children,
}: {
    label?: string;
    className?: string;
    /** Pads the column into a card (the recipient reward boxes). */
    padding?: "m";
    children: ReactNode;
}) {
    return (
        <FieldLabel
            label={label}
            className={`${className ?? styles.tierField}${padding === "m" ? ` ${styles.tierPadded}` : ""}`}
        >
            {children}
        </FieldLabel>
    );
}

/**
 * One tier as a self-contained card: title (+ trash on tier 2+), basket range,
 * Target CPA + unit, and the Ambassador/Referee reward boxes. The range, CPA
 * and unit live on `globalCpaTiers[index]`; the rewards on the recipient arrays
 * at the same index. The parent renders a distribution bar below each card.
 */
function TierCard({
    control,
    index,
    isLast,
    unit,
    fromError,
    toError,
    cpaError,
    onRemove,
    onCpaChange,
    onRewardChange,
}: {
    control: Control<RewardFormValues>;
    index: number;
    isLast: boolean;
    unit: UnitKind;
    fromError?: boolean;
    toError?: boolean;
    cpaError?: boolean;
    onRemove: () => void;
    /** Re-recommends this tier's split when its Target CPA changes. */
    onCpaChange?: (next: number | "") => void;
    /** Re-derives this tier's Target CPA when a recipient reward changes. */
    onRewardChange?: (
        recipient: "ambassador" | "referee",
        next: number | ""
    ) => void;
}) {
    const { t } = useTranslation();
    const glyph = useCurrencyGlyph();
    return (
        <Stack space="m" padding="m" className={styles.tierCard}>
            <Inline space="none" align="space-between" alignY="center">
                <Text variant="body">
                    {t("campaigns.create.reward.tiered.tierLabel", {
                        n: index + 1,
                    })}
                </Text>
                {index > 0 && (
                    <TierDelete
                        onRemove={onRemove}
                        label={t("campaigns.create.reward.tiered.removeTier")}
                    />
                )}
            </Inline>

            <Inline space="xxs" alignY="bottom" wrap={false}>
                <TierField
                    label={t("campaigns.create.reward.tiered.basketRange", {
                        glyph,
                    })}
                >
                    <TierCell
                        control={control}
                        name={`globalCpaTiers.${index}.from`}
                        unit="amount"
                        tone="elevated"
                        error={fromError}
                        placeholder={t(
                            "campaigns.create.reward.tiered.fromPlaceholder"
                        )}
                    />
                </TierField>
                <span className={styles.tierArrow}>
                    <ArrowRightIcon width={24} height={24} />
                </span>
                <TierField>
                    <TierCell
                        control={control}
                        name={`globalCpaTiers.${index}.to`}
                        unit="amount"
                        tone="elevated"
                        error={toError}
                        placeholder={
                            isLast
                                ? "∞"
                                : t(
                                      "campaigns.create.reward.tiered.toPlaceholder"
                                  )
                        }
                    />
                </TierField>
            </Inline>

            <div className={styles.tierCpaRow}>
                <TierField
                    label={t("campaigns.create.reward.tiered.globalCpaTitle")}
                >
                    <TierCell
                        control={control}
                        name={`globalCpaTiers.${index}.cpa`}
                        unit={unit}
                        tone="elevated"
                        stepper
                        step={0.01}
                        error={cpaError}
                        onChangeExtra={onCpaChange}
                        placeholder={t(
                            "campaigns.create.reward.tiered.cpaPlaceholder"
                        )}
                    />
                </TierField>
                <TierField
                    label={t("campaigns.create.reward.tiered.unit")}
                    className={styles.tierUnitField}
                >
                    <UnitSelectField
                        control={control}
                        name={`globalCpaTiers.${index}.unit`}
                        tone="elevated"
                    />
                </TierField>
            </div>

            <Inline space="xs" alignY="top" wrap={false}>
                <TierField
                    label={t(
                        "campaigns.create.reward.recipient.ambassadorReward"
                    )}
                    className={styles.tierRecipientCard}
                    padding="m"
                >
                    <TierCell
                        control={control}
                        name={`ambassadorTiers.${index}.reward`}
                        unit={unit}
                        stepper
                        step={0.01}
                        onChangeExtra={(next) =>
                            onRewardChange?.("ambassador", next)
                        }
                        placeholder={t(
                            "campaigns.create.reward.tiered.rewardPlaceholder"
                        )}
                    />
                </TierField>
                <TierField
                    label={t("campaigns.create.reward.recipient.refereeReward")}
                    className={styles.tierRecipientCard}
                    padding="m"
                >
                    <TierCell
                        control={control}
                        name={`refereeTiers.${index}.reward`}
                        unit={unit}
                        stepper
                        step={0.01}
                        onChangeExtra={(next) =>
                            onRewardChange?.("referee", next)
                        }
                        placeholder={t(
                            "campaigns.create.reward.tiered.rewardPlaceholder"
                        )}
                    />
                </TierField>
            </Inline>
        </Stack>
    );
}

function TieredReveal({
    control,
    setValue,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
}) {
    const { t } = useTranslation();
    const glyph = useCurrencyGlyph();
    // One field array per tiered column; appended/removed together so they stay
    // index-aligned (Global CPA holds the range/unit, recipients hold rewards).
    const globalArray = useFieldArray({ control, name: "globalCpaTiers" });
    const ambassadorArray = useFieldArray({ control, name: "ambassadorTiers" });
    const refereeArray = useFieldArray({ control, name: "refereeTiers" });

    const tiers = (useWatch({ control, name: "globalCpaTiers" }) ??
        []) as CpaTierRow[];
    // The per-tier reward amounts, watched so a CPA change can tell an untouched
    // reco (track the new CPA) apart from a user-edited split (leave it).
    const ambTiers = (useWatch({ control, name: "ambassadorTiers" }) ?? []) as {
        reward: number | "";
    }[];
    const refTiers = (useWatch({ control, name: "refereeTiers" }) ?? []) as {
        reward: number | "";
    }[];
    // Errors are gated per-field on touch (blur): a field reds only once the user
    // has left it empty, so filling one input never reds its still-pristine
    // neighbours (and a just-added tier stays clean).
    const { touchedFields } = useFormState({ control });
    const touched = touchedFields.globalCpaTiers;
    const fieldErrors = (
        i: number,
        tier: CpaTierRow | undefined,
        isLast: boolean
    ) => {
        const tf = touched?.[i];
        return {
            from: Boolean(tf?.from) && (!tier || tier.from === ""),
            to: Boolean(tf?.to) && !isLast && (!tier || tier.to === ""),
            cpa: Boolean(tf?.cpa) && !(Number(tier?.cpa) > 0),
        };
    };
    const lastIndex = tiers.length - 1;
    // The summary surfaces only alongside an actually-red field, never alone.
    const incomplete = tiers.some((tier, i) => {
        const e = fieldErrors(i, tier, i === lastIndex);
        return e.from || e.to || e.cpa;
    });
    const tiersOverlap = tieredRangesOverlap(tiers);
    const hasCpa = tiers.some((tier) => Number(tier.cpa) > 0);

    function addTier() {
        // Chain ranges gaplessly: new tier starts at the previous max. Bounds
        // are inclusive and the backend resolves the shared boundary to the
        // upper tier (sorted by minValue desc), so no basket value falls
        // through — unlike a +1 step, which would skip fractional baskets.
        const prevTo = tiers.at(-1)?.to;
        const from = typeof prevTo === "number" ? prevTo : "";
        globalArray.append({ from, to: "", cpa: "", unit: "percent" });
        ambassadorArray.append({ reward: "" });
        refereeArray.append({ reward: "" });
    }
    function removeTier(index: number) {
        globalArray.remove(index);
        ambassadorArray.remove(index);
        refereeArray.remove(index);
    }
    // Mirror the Fixed/% reveal: when a tier's Target CPA changes and its split
    // is still the untouched reco, recompute it for the new CPA (a user-edited
    // split is left as-is). Shared via `recalcSplitOnCpaChange`.
    function handleCpaChange(index: number, next: number | "") {
        const reco = recalcSplitOnCpaChange({
            prevCpa: Number(tiers[index]?.cpa) || 0,
            nextCpa: Number(next) || 0,
            ambassador: Number(ambTiers[index]?.reward) || 0,
            referee: Number(refTiers[index]?.reward) || 0,
        });
        if (!reco) return;
        setValue(`ambassadorTiers.${index}.reward`, reco.ambassador, {
            shouldValidate: true,
            shouldDirty: true,
        });
        setValue(`refereeTiers.${index}.reward`, reco.referee, {
            shouldValidate: true,
            shouldDirty: true,
        });
    }
    // Reverse of `handleCpaChange`: editing a recipient reward makes the split
    // the source of truth, so re-derive that tier's Target CPA (pool ÷
    // rewards-share, to the cent) — mirroring the Fixed/% reveal.
    function handleRewardChange(
        index: number,
        recipient: "ambassador" | "referee",
        next: number | ""
    ) {
        const ambassador =
            recipient === "ambassador"
                ? Number(next) || 0
                : Number(ambTiers[index]?.reward) || 0;
        const referee =
            recipient === "referee"
                ? Number(next) || 0
                : Number(refTiers[index]?.reward) || 0;
        setValue(
            `globalCpaTiers.${index}.cpa`,
            recalcCpaFromSplit(ambassador, referee),
            { shouldValidate: true, shouldDirty: true }
        );
    }
    // Fill the recommended 80/20 split per tier; the distribution bar always
    // shows that ratio, but the amounts stay the user's to override. Written via
    // `setValue` (not the field array's `replace`) so it reaches the recipient
    // inputs, which are registered by name rather than mapped from `fields`.
    function applyReco() {
        tiers.forEach((g, i) => {
            const { ambassador, referee } = recommendedSplit(
                Number(g.cpa) || 0
            );
            setValue(`ambassadorTiers.${i}.reward`, ambassador, {
                shouldValidate: true,
                shouldDirty: true,
            });
            setValue(`refereeTiers.${i}.reward`, referee, {
                shouldValidate: true,
                shouldDirty: true,
            });
        });
    }

    return (
        <Stack space="m">
            <RevealHeader />

            {globalArray.fields.map((row, index) => {
                const tier = tiers[index];
                const isLast = index === globalArray.fields.length - 1;
                const unit = (tier?.unit ?? "amount") as UnitKind;
                const errors = fieldErrors(index, tier, isLast);
                const { rewardsPool, frakCommission } = splitTargetCpa(
                    Number(tier?.cpa) || 0
                );
                return (
                    <Fragment key={row.id}>
                        <TierCard
                            control={control}
                            index={index}
                            isLast={isLast}
                            unit={unit}
                            fromError={errors.from}
                            toError={errors.to}
                            cpaError={errors.cpa}
                            onRemove={() => removeTier(index)}
                            onCpaChange={(next) => handleCpaChange(index, next)}
                            onRewardChange={(recipient, next) =>
                                handleRewardChange(index, recipient, next)
                            }
                        />
                        <div className={styles.tierDistribution}>
                            <DistributionBar
                                rewardsLabel={t(
                                    "campaigns.create.reward.cpa.rewardsDistributed"
                                )}
                                commissionLabel={t(
                                    "campaigns.create.reward.cpa.frakCommission"
                                )}
                                rewardsAmount={rewardsPool}
                                commissionAmount={frakCommission}
                                suffix={unit === "amount" ? glyph : "%"}
                            />
                        </div>
                    </Fragment>
                );
            })}

            {/* The reco sits below the tiers and surfaces only once a Target
                CPA exists; applying it fills every tier's 80/20 split. */}
            {hasCpa && <RecoBar onApply={applyReco} />}

            <Inline space="none">
                <Button
                    type="button"
                    variant="primary"
                    size="small"
                    rightIcon={<PlusIcon width={16} height={16} />}
                    onClick={addTier}
                >
                    {t("campaigns.create.reward.tiered.addTier")}
                </Button>
            </Inline>

            {incomplete ? (
                <FieldError>
                    {t("campaigns.create.reward.tiered.incomplete")}
                </FieldError>
            ) : tiersOverlap ? (
                <FieldError>
                    {t("campaigns.create.reward.tiered.overlap")}
                </FieldError>
            ) : null}

            <TriggeredRow />
        </Stack>
    );
}

/* ------------------------------------------------------------------ */
/*  Eligibility + lockup                                               */
/* ------------------------------------------------------------------ */

// Exported for unit testing.
export function EligibilityField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="minPurchaseAmount"
            render={({ field }) => (
                <StepperField
                    field={field}
                    unit="amount"
                    allowZero
                    placeholder={t(
                        "campaigns.create.reward.eligibility.minPurchasePlaceholder"
                    )}
                    label={t(
                        "campaigns.create.reward.eligibility.minPurchaseLabel"
                    )}
                    hint={t(
                        "campaigns.create.reward.eligibility.minPurchaseHint"
                    )}
                />
            )}
        />
    );
}

/**
 * Basis toggle for a product-scoped campaign: pay on the whole basket, or on
 * the scoped items only. Locked to "eligible products" when the scope is
 * negated — the backend requires it, so the choice isn't the merchant's.
 * Exported for unit testing.
 */
export function RewardBasisField({
    control,
    locked,
}: {
    control: Control<RewardFormValues>;
    locked: boolean;
}) {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            {locked && (
                <InfoBanner>
                    {t("campaigns.create.reward.basis.lockedNote")}
                </InfoBanner>
            )}
            <Controller
                control={control}
                name="rewardBasis"
                render={({ field }) => (
                    <RadioGroup
                        value={locked ? "matchedItems" : field.value}
                        onValueChange={field.onChange}
                        disabled={locked}
                    >
                        {(["basket", "matchedItems"] as const).map((basis) => (
                            <label
                                key={basis}
                                htmlFor={`reward-basis-${basis}`}
                                className={rows.optionRow}
                            >
                                <RadioGroupItem
                                    id={`reward-basis-${basis}`}
                                    value={basis}
                                    size="l"
                                    disabled={locked}
                                />
                                <span className={rows.optionMain}>
                                    <Text variant="body" weight="medium">
                                        {t(
                                            `campaigns.create.reward.basis.${basis}.title`
                                        )}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            `campaigns.create.reward.basis.${basis}.description`
                                        )}
                                    </Text>
                                </span>
                            </label>
                        ))}
                    </RadioGroup>
                )}
            />
        </Stack>
    );
}

// Exported for unit testing.
export function LockupField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            <InfoBanner>{t("campaigns.create.reward.lockup.info")}</InfoBanner>
            <Controller
                control={control}
                name="lockupDays"
                render={({ field }) => (
                    <StepperField
                        field={field}
                        unitLabel={t("campaigns.create.reward.lockup.unit")}
                        allowZero
                        placeholder={t(
                            "campaigns.create.reward.lockup.durationPlaceholder"
                        )}
                        label={t(
                            "campaigns.create.reward.lockup.durationLabel"
                        )}
                        hint={t("campaigns.create.reward.lockup.durationHint")}
                    />
                )}
            />
        </Stack>
    );
}

/* ------------------------------------------------------------------ */

export function RewardCampaign() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();
    const currencyGlyph = useCampaignCurrencyGlyph();

    const defaultValues = useMemo(() => draftToRewardForm(draft), [draft]);

    const form = useForm<RewardFormValues>({
        values: defaultValues,
        mode: "onChange",
    });

    const model = useWatch({ control: form.control, name: "model" });

    // A scoped campaign can pay on the matched items; a negated scope must.
    const isScoped = supportsMatchedBasis(draft);
    const basisLocked = requiresMatchedBasis(draft);

    const watched = useWatch({ control: form.control });
    const isValid = isRewardFormValid(
        {
            ...DEFAULT_REWARD_FORM,
            ...watched,
        } as RewardFormValues,
        { requiresMatchedBasis: basisLocked }
    );

    async function persist(values: RewardFormValues) {
        const updated = rewardFormToDraft(values, { ...draft, merchantId });
        updateDraft(() => updated);
        return saveCampaign.mutateAsync(updated);
    }

    async function onSubmit(values: RewardFormValues) {
        const saved = await persist(values);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/referral-chain",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(persist);

    return (
        <CurrencyGlyphContext.Provider value={currencyGlyph}>
            <WizardStep
                stepKey="reward"
                formId={FORM_ID}
                isValid={isValid}
                isPending={saveCampaign.isPending}
                onSaveDraft={handleSaveDraft}
                onClose={() => form.reset(defaultValues)}
                hasUnsavedChanges={form.formState.isDirty}
            >
                <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                    <Stack space="l">
                        {saveCampaign.isError && (
                            <InfoBanner tone="error">
                                {t("campaigns.create.reward.saveError")}
                            </InfoBanner>
                        )}
                        <WizardFieldCard
                            space="xs"
                            label={t(
                                "campaigns.create.reward.campaignType.label"
                            )}
                            description={t(
                                "campaigns.create.reward.campaignType.description"
                            )}
                        >
                            <CampaignTypeField control={form.control} />
                        </WizardFieldCard>

                        <WizardFieldCard
                            space="xs"
                            label={t("campaigns.create.reward.model.label")}
                            description={t(
                                "campaigns.create.reward.model.description"
                            )}
                        >
                            <Stack space="m">
                                <Controller
                                    control={form.control}
                                    name="model"
                                    render={({ field }) => (
                                        <RadioGroup
                                            className={styles.modelRow}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            {MODELS.map((m) => (
                                                <label
                                                    key={m.value}
                                                    htmlFor={`model-${m.value}`}
                                                    className={
                                                        styles.modelOption
                                                    }
                                                >
                                                    <RadioGroupItem
                                                        id={`model-${m.value}`}
                                                        value={m.value}
                                                        size="l"
                                                    />
                                                    <span
                                                        className={
                                                            styles.modelMain
                                                        }
                                                    >
                                                        <Text
                                                            variant="body"
                                                            weight="medium"
                                                        >
                                                            {t(m.titleKey)}
                                                        </Text>
                                                        <Text
                                                            variant="bodySmall"
                                                            color="secondary"
                                                        >
                                                            {t(m.descKey)}
                                                        </Text>
                                                    </span>
                                                </label>
                                            ))}
                                        </RadioGroup>
                                    )}
                                />

                                {model && <div className={styles.divider} />}
                                {model === "fixed" && (
                                    <FixedReveal
                                        control={form.control}
                                        setValue={form.setValue}
                                    />
                                )}
                                {model === "percentage" && (
                                    <PercentageReveal
                                        control={form.control}
                                        setValue={form.setValue}
                                    />
                                )}
                                {model === "tiered" && (
                                    <TieredReveal
                                        control={form.control}
                                        setValue={form.setValue}
                                    />
                                )}
                            </Stack>
                        </WizardFieldCard>

                        {isScoped && model && model !== "fixed" && (
                            <WizardFieldCard
                                space="xs"
                                label={t("campaigns.create.reward.basis.label")}
                                description={t(
                                    "campaigns.create.reward.basis.description"
                                )}
                            >
                                <RewardBasisField
                                    control={form.control}
                                    locked={basisLocked}
                                />
                            </WizardFieldCard>
                        )}

                        {basisLocked && model === "fixed" && (
                            <InfoBanner tone="error">
                                {t(
                                    "campaigns.create.reward.basis.fixedNotAllowed"
                                )}
                            </InfoBanner>
                        )}

                        {model !== "tiered" && (
                            <WizardFieldCard
                                space="xs"
                                label={t(
                                    "campaigns.create.reward.eligibility.label"
                                )}
                                description={t(
                                    "campaigns.create.reward.eligibility.description"
                                )}
                            >
                                <EligibilityField control={form.control} />
                            </WizardFieldCard>
                        )}

                        <WizardFieldCard
                            space="xs"
                            label={t("campaigns.create.reward.lockup.label")}
                            description={t(
                                "campaigns.create.reward.lockup.description"
                            )}
                        >
                            <LockupField control={form.control} />
                        </WizardFieldCard>
                    </Stack>
                </form>
            </WizardStep>
        </CurrencyGlyphContext.Provider>
    );
}
