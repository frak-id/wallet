import { FieldError } from "@frak-labs/design-system/components/FieldError";
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
    EurCodeIcon,
    LightbulbIcon,
    PercentIcon,
    PlusIcon,
} from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import {
    type Control,
    Controller,
    type ControllerRenderProps,
    type UseFieldArrayReturn,
    type UseFormGetValues,
    type UseFormSetValue,
    useFieldArray,
    useForm,
    useFormState,
    useWatch,
} from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Button } from "@/module/common/component/Button";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { InputNumber } from "@/module/forms/InputNumber";
import { campaignStore } from "@/stores/campaignStore";
import { DistributionBar } from "../DistributionBar";
import { InfoBanner } from "../InfoBanner";
import { WizardFieldCard } from "../WizardFieldCard";
import { WizardStep } from "../WizardStep";
import * as styles from "./reward.css";
import {
    type CpaTierRow,
    DEFAULT_REWARD_FORM,
    draftToRewardForm,
    isRewardFormValid,
    type RewardFormValues,
    type RewardModel,
    recommendedSplit,
    rewardFormToDraft,
    splitTargetCpa,
    type TierRow,
    type TierUnit,
    tieredTiersValid,
} from "./utils";

const FORM_ID = "campaign-reward-form";

type UnitGlyph = "eur" | "percent";

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

function UnitIcon({ unit }: { unit: UnitGlyph }) {
    const Icon = unit === "eur" ? EurCodeIcon : PercentIcon;
    return <Icon width={24} height={24} className={styles.unitIcon} />;
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
    unit?: UnitGlyph;
    /** A localised text unit (e.g. "DAYS"/"JOURS"); a word can't be a glyph. */
    unitLabel?: string;
    placeholder: string;
    ariaLabel: string;
    /** "muted" = grey filled (default), "elevated" = white. */
    tone?: "muted" | "elevated";
    /** Keep a literal `0` visible (e.g. min-purchase/lockup, where 0 is valid). */
    allowZero?: boolean;
    /** Fill the field with the error surface when invalid. */
    error?: boolean;
};

/** A numeric field with a double-chevron stepper and a trailing unit. */
function StepperField({
    field,
    unit,
    unitLabel,
    placeholder,
    ariaLabel,
    tone = "muted",
    allowZero = false,
    error,
}: StepperFieldProps) {
    return (
        <InputNumber
            variant="bare"
            tone={tone}
            error={error}
            aria-label={ariaLabel}
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

function RecipientBox({
    control,
    name,
    label,
    unit,
    placeholder,
    hint,
    error,
}: {
    control: Control<RewardFormValues>;
    name:
        | "ambassadorAmount"
        | "refereeAmount"
        | "ambassadorPercent"
        | "refereePercent";
    label: string;
    unit: UnitGlyph;
    placeholder: string;
    /** Omitted (e.g. while the input is empty) ⇒ no hint line is rendered. */
    hint?: string;
    /** Tint the input red when the split is invalid. */
    error?: boolean;
}) {
    return (
        <div className={styles.recipientBox}>
            <Text
                variant="bodySmall"
                weight="medium"
                color="secondary"
                className={styles.insetX}
            >
                {label}
            </Text>
            <Controller
                control={control}
                name={name}
                render={({ field }) => (
                    <StepperField
                        field={field}
                        unit={unit}
                        tone="elevated"
                        error={error}
                        placeholder={placeholder}
                        ariaLabel={label}
                    />
                )}
            />
            {hint ? (
                <Text
                    variant="caption"
                    color="tertiary"
                    className={styles.insetX}
                >
                    {hint}
                </Text>
            ) : null}
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

function CpaReveal({
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
    unit: "eur" | "percent";
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
    const suffix = unit === "eur" ? "€" : "%";

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

    return (
        <Stack space="m">
            <RevealHeader />

            <Stack space="xs">
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    className={styles.insetX}
                >
                    {cpaLabel}
                </Text>
                <Controller
                    control={control}
                    name={cpaName}
                    render={({ field }) => (
                        <StepperField
                            field={{
                                ...field,
                                // Changing the Target CPA changes the pool, so
                                // the previous split no longer adds up — clear
                                // it (this also re-surfaces the reco bar).
                                onChange: (next) => {
                                    field.onChange(next);
                                    setValue(ambName, 0, {
                                        shouldValidate: true,
                                    });
                                    setValue(refName, 0, {
                                        shouldValidate: true,
                                    });
                                },
                            }}
                            unit={unit}
                            placeholder={cpaPlaceholder}
                            ariaLabel={cpaLabel}
                        />
                    )}
                />
                <Text
                    variant="caption"
                    color="tertiary"
                    className={styles.insetX}
                >
                    {t("campaigns.create.reward.cpa.hint")}
                </Text>
            </Stack>

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
                        placeholder={ambPlaceholder}
                        error={splitMismatch}
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
                        placeholder={refPlaceholder}
                        error={splitMismatch}
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
            unit="eur"
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
}: {
    control: Control<RewardFormValues>;
    name: string;
    tone?: "muted" | "elevated";
}) {
    return (
        <Controller
            control={control}
            // biome-ignore lint/suspicious/noExplicitAny: dynamic field-array path
            name={name as any}
            render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
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
                        <SelectItem value="eur">€</SelectItem>
                    </SelectContent>
                </Select>
            )}
        />
    );
}

/** A grey filled tier input with a trailing unit glyph (no stepper). */
function TierCell({
    control,
    name,
    placeholder,
    unit,
    onEdit,
    tone = "muted",
    error,
}: {
    control: Control<RewardFormValues>;
    name: string;
    placeholder: string;
    unit: UnitGlyph;
    onEdit?: () => void;
    tone?: "muted" | "elevated";
    error?: boolean;
}) {
    return (
        <Controller
            control={control}
            // biome-ignore lint/suspicious/noExplicitAny: dynamic field-array path
            name={name as any}
            render={({ field }) => (
                <InputNumber
                    variant="bare"
                    tone={tone}
                    error={error}
                    classNameWrapper={styles.inputWrapper}
                    placeholder={placeholder}
                    rightSection={<UnitIcon unit={unit} />}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(event) => {
                        onEdit?.();
                        field.onChange(event);
                    }}
                />
            )}
        />
    );
}

/** A value cell (CPA/reward) whose trailing glyph follows the row's unit. */
function ValueCell({
    control,
    valueName,
    unitName,
    placeholder,
    tone = "muted",
    error,
}: {
    control: Control<RewardFormValues>;
    valueName: string;
    unitName: string;
    placeholder: string;
    tone?: "muted" | "elevated";
    error?: boolean;
}) {
    const unit =
        // biome-ignore lint/suspicious/noExplicitAny: dynamic field-array path
        (useWatch({ control, name: unitName as any }) as UnitGlyph) ?? "eur";
    return (
        <TierCell
            control={control}
            name={valueName}
            placeholder={placeholder}
            unit={unit}
            tone={tone}
            error={error}
        />
    );
}

/** Basket-range cell: `from → to` (both EUR). `lastTier` shows ∞ as the cap. */
function RangeCell({
    control,
    fromName,
    toName,
    lastTier,
    onEdit,
    tone = "muted",
    fromError,
    toError,
}: {
    control: Control<RewardFormValues>;
    fromName: string;
    toName: string;
    lastTier: boolean;
    onEdit?: () => void;
    tone?: "muted" | "elevated";
    fromError?: boolean;
    toError?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <div className={styles.tierBasket}>
            <div className={styles.tierBasketInput}>
                <TierCell
                    control={control}
                    name={fromName}
                    unit="eur"
                    onEdit={onEdit}
                    tone={tone}
                    error={fromError}
                    placeholder={t(
                        "campaigns.create.reward.tiered.fromPlaceholder"
                    )}
                />
            </div>
            <span className={styles.tierArrow}>
                <ArrowRightIcon width={24} height={24} />
            </span>
            <div className={styles.tierBasketInput}>
                <TierCell
                    control={control}
                    name={toName}
                    unit="eur"
                    onEdit={onEdit}
                    tone={tone}
                    error={toError}
                    placeholder={
                        lastTier
                            ? "∞"
                            : t("campaigns.create.reward.tiered.toPlaceholder")
                    }
                />
            </div>
        </div>
    );
}

/** Column-header row (labels) shown once above the tiers. */
function TierHeader({ valueLabel }: { valueLabel: string }) {
    const { t } = useTranslation();
    return (
        <div className={styles.tierHeader}>
            <div className={styles.tierLabelBasket}>
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    className={styles.tierLabel}
                >
                    {t("campaigns.create.reward.tiered.basketRange")}
                </Text>
            </div>
            <div className={styles.tierValueUnit}>
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    className={`${styles.tierValue} ${styles.tierLabel}`}
                >
                    {valueLabel}
                </Text>
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    className={`${styles.tierUnit} ${styles.tierLabel}`}
                >
                    {t("campaigns.create.reward.tiered.unit")}
                </Text>
            </div>
            <span className={styles.tierLabelSpacer} />
        </div>
    );
}

/** A delete (trash) button; hidden but space-reserved on the first tier. */
function TierDelete({
    index,
    onRemove,
    label,
}: {
    index: number;
    onRemove: () => void;
    label: string;
}) {
    const hidden = index === 0;
    return (
        <button
            type="button"
            className={`${styles.tierDelete} ${hidden ? styles.tierDeleteHidden : ""}`}
            aria-label={label}
            disabled={hidden}
            onClick={onRemove}
        >
            <DeleteIcon width={24} height={24} />
        </button>
    );
}

/** Global CPA tier table: basket range · CPA · unit. Defines the tiers. */
function GlobalCpaTable({ control }: { control: Control<RewardFormValues> }) {
    const { t } = useTranslation();
    const { fields, append, remove } = useFieldArray({
        control,
        name: "globalCpaTiers",
    });
    // Live tier values + a dirty gate, so errors only surface once the user has
    // started filling the table (not on a pristine, just-selected tiered model).
    const tiers = (useWatch({ control, name: "globalCpaTiers" }) ??
        []) as CpaTierRow[];
    const { dirtyFields } = useFormState({ control });
    const showErrors = Boolean(dirtyFields.globalCpaTiers);
    const tiersInvalid = !tieredTiersValid(tiers);

    return (
        <Stack space="xs">
            <Text
                variant="bodySmall"
                weight="medium"
                color="secondary"
                className={styles.tierTitle}
            >
                {t("campaigns.create.reward.tiered.globalCpaTitle")}
            </Text>
            <TierHeader
                valueLabel={t("campaigns.create.reward.tiered.cpaColumn")}
            />

            {fields.map((row, index) => {
                const tier = tiers[index];
                const isLast = index === fields.length - 1;
                const fromError = showErrors && (!tier || tier.from === "");
                const toError =
                    showErrors && !isLast && (!tier || tier.to === "");
                const cpaError = showErrors && !(Number(tier?.cpa) > 0);
                return (
                    <div className={styles.tierRow} key={row.id}>
                        <RangeCell
                            control={control}
                            fromName={`globalCpaTiers.${index}.from`}
                            toName={`globalCpaTiers.${index}.to`}
                            lastTier={isLast}
                            fromError={fromError}
                            toError={toError}
                        />
                        <div className={styles.tierValueUnit}>
                            <div className={styles.tierValue}>
                                <ValueCell
                                    control={control}
                                    valueName={`globalCpaTiers.${index}.cpa`}
                                    unitName={`globalCpaTiers.${index}.unit`}
                                    error={cpaError}
                                    placeholder={t(
                                        "campaigns.create.reward.tiered.cpaPlaceholder"
                                    )}
                                />
                            </div>
                            <div className={styles.tierUnit}>
                                <UnitSelectField
                                    control={control}
                                    name={`globalCpaTiers.${index}.unit`}
                                />
                            </div>
                        </div>
                        <TierDelete
                            index={index}
                            onRemove={() => remove(index)}
                            label={t(
                                "campaigns.create.reward.tiered.removeTier"
                            )}
                        />
                    </div>
                );
            })}

            <div className={styles.tierAddButton}>
                <Button
                    type="button"
                    variant="primary"
                    size="small"
                    rightIcon={<PlusIcon width={16} height={16} />}
                    onClick={() =>
                        append({ from: "", to: "", cpa: "", unit: "eur" })
                    }
                >
                    {t("campaigns.create.reward.tiered.addTier")}
                </Button>
            </div>
            <Text
                variant="caption"
                color="secondary"
                className={styles.tierFootnote}
            >
                {t("campaigns.create.reward.tiered.commissionFootnote")}
            </Text>
            {showErrors && tiersInvalid ? (
                <FieldError>
                    {t("campaigns.create.reward.tiered.incomplete")}
                </FieldError>
            ) : null}
        </Stack>
    );
}

/** Ambassador/Referee reward tier table: basket range · reward · unit. */
function RewardTierTable({
    control,
    name,
    fields,
    append,
    remove,
    title,
    description,
    onRangeEdit,
}: {
    control: Control<RewardFormValues>;
    name: "ambassadorTiers" | "refereeTiers";
    /** Lifted to the parent so the prefill sync and rendering share one array. */
    fields: { id: string }[];
    append: (value: TierRow) => void;
    remove: (index: number) => void;
    title: string;
    description: string;
    onRangeEdit: () => void;
}) {
    const { t } = useTranslation();
    const defaultUnit: TierUnit =
        name === "ambassadorTiers" ? "percent" : "eur";

    return (
        <div className={styles.tierCard}>
            <Stack space="xxs">
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {title}
                </Text>
                <Text variant="caption" color="tertiary">
                    {description}
                </Text>
            </Stack>

            <Stack space="xs">
                <TierHeader
                    valueLabel={t("campaigns.create.reward.tiered.reward")}
                />

                {fields.map((row, index) => (
                    <div className={styles.tierRow} key={row.id}>
                        <RangeCell
                            control={control}
                            fromName={`${name}.${index}.from`}
                            toName={`${name}.${index}.to`}
                            lastTier={index === fields.length - 1}
                            onEdit={onRangeEdit}
                            tone="elevated"
                        />
                        <div className={styles.tierValueUnit}>
                            <div className={styles.tierValue}>
                                <ValueCell
                                    control={control}
                                    valueName={`${name}.${index}.reward`}
                                    unitName={`${name}.${index}.unit`}
                                    tone="elevated"
                                    placeholder={t(
                                        "campaigns.create.reward.tiered.rewardPlaceholder"
                                    )}
                                />
                            </div>
                            <div className={styles.tierUnit}>
                                <UnitSelectField
                                    control={control}
                                    name={`${name}.${index}.unit`}
                                    tone="elevated"
                                />
                            </div>
                        </div>
                        <TierDelete
                            index={index}
                            onRemove={() => remove(index)}
                            label={t(
                                "campaigns.create.reward.tiered.removeTier"
                            )}
                        />
                    </div>
                ))}
            </Stack>

            <div>
                <Button
                    type="button"
                    variant="primary"
                    size="small"
                    rightIcon={<PlusIcon width={16} height={16} />}
                    onClick={() => {
                        onRangeEdit();
                        append({
                            from: "",
                            to: "",
                            reward: "",
                            unit: defaultUnit,
                        });
                    }}
                >
                    {t("campaigns.create.reward.tiered.addTier")}
                </Button>
            </div>
        </div>
    );
}

function TieredReveal({
    control,
    setValue,
    getValues,
    ambassadorArray,
    refereeArray,
    ambassadorRef,
    refereeRef,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    getValues: UseFormGetValues<RewardFormValues>;
    ambassadorArray: UseFieldArrayReturn<RewardFormValues, "ambassadorTiers">;
    refereeArray: UseFieldArrayReturn<RewardFormValues, "refereeTiers">;
    ambassadorRef: React.RefObject<boolean>;
    refereeRef: React.RefObject<boolean>;
}) {
    const { t } = useTranslation();
    // Destructure the stable `replace` methods; depending on the whole array
    // object (recreated each render) would loop the prefill effect.
    const { replace: replaceAmbassador } = ambassadorArray;
    const { replace: replaceReferee } = refereeArray;
    const globalTiers = useWatch({ control, name: "globalCpaTiers" }) ?? [];

    // Auto-prefill Ambassador/Referee basket ranges from the Global CPA tiers,
    // syncing on every Global change until the user edits that table's ranges.
    useEffect(() => {
        if (!ambassadorRef.current) {
            const existing = getValues("ambassadorTiers");
            replaceAmbassador(
                globalTiers.map((g, i) => ({
                    from: g.from,
                    to: g.to,
                    reward: existing[i]?.reward ?? "",
                    unit: existing[i]?.unit ?? "percent",
                }))
            );
        }
        if (!refereeRef.current) {
            const existing = getValues("refereeTiers");
            replaceReferee(
                globalTiers.map((g, i) => ({
                    from: g.from,
                    to: g.to,
                    reward: existing[i]?.reward ?? "",
                    unit: existing[i]?.unit ?? "eur",
                }))
            );
        }
    }, [
        globalTiers,
        getValues,
        replaceAmbassador,
        replaceReferee,
        ambassadorRef,
        refereeRef,
    ]);

    const hasCpa = globalTiers.some((tier) => Number(tier.cpa) > 0);

    function applyReco() {
        const current = getValues();
        const split = (cpa: number | "", share: 0.8 | 0.2) =>
            recommendedSplit(Number(cpa) || 0)[
                share === 0.8 ? "ambassador" : "referee"
            ];
        replaceAmbassador(
            current.globalCpaTiers.map((g) => ({
                from: g.from,
                to: g.to,
                reward: split(g.cpa, 0.8),
                unit: g.unit,
            }))
        );
        replaceReferee(
            current.globalCpaTiers.map((g) => ({
                from: g.from,
                to: g.to,
                reward: split(g.cpa, 0.2),
                unit: g.unit,
            }))
        );
        setValue("globalCpaTiers", current.globalCpaTiers);
    }

    return (
        <Stack space="m">
            <RevealHeader />

            <GlobalCpaTable control={control} />

            {/* Reco + recipient tables surface only once a Target CPA exists. */}
            {hasCpa && (
                <>
                    <RecoBar onApply={applyReco} />
                    <RewardTierTable
                        control={control}
                        name="ambassadorTiers"
                        fields={ambassadorArray.fields}
                        append={ambassadorArray.append}
                        remove={ambassadorArray.remove}
                        title={t(
                            "campaigns.create.reward.recipient.ambassadorReward"
                        )}
                        description={t(
                            "campaigns.create.reward.tiered.ambassadorDescription"
                        )}
                        onRangeEdit={() => {
                            ambassadorRef.current = true;
                        }}
                    />
                    <RewardTierTable
                        control={control}
                        name="refereeTiers"
                        fields={refereeArray.fields}
                        append={refereeArray.append}
                        remove={refereeArray.remove}
                        title={t(
                            "campaigns.create.reward.recipient.refereeReward"
                        )}
                        description={t(
                            "campaigns.create.reward.tiered.refereeDescription"
                        )}
                        onRangeEdit={() => {
                            refereeRef.current = true;
                        }}
                    />
                </>
            )}

            <TriggeredRow />
        </Stack>
    );
}

/* ------------------------------------------------------------------ */
/*  Eligibility + lockup                                               */
/* ------------------------------------------------------------------ */

function EligibilityField({ control }: { control: Control<RewardFormValues> }) {
    const { t } = useTranslation();
    return (
        <Stack space="xs">
            <Text
                variant="bodySmall"
                weight="medium"
                color="secondary"
                className={styles.insetX}
            >
                {t("campaigns.create.reward.eligibility.minPurchaseLabel")}
            </Text>
            <Controller
                control={control}
                name="minPurchaseAmount"
                render={({ field }) => (
                    <StepperField
                        field={field}
                        unit="eur"
                        allowZero
                        placeholder={t(
                            "campaigns.create.reward.eligibility.minPurchasePlaceholder"
                        )}
                        ariaLabel={t(
                            "campaigns.create.reward.eligibility.minPurchaseLabel"
                        )}
                    />
                )}
            />
            <Text variant="caption" color="tertiary" className={styles.insetX}>
                {t("campaigns.create.reward.eligibility.minPurchaseHint")}
            </Text>
        </Stack>
    );
}

function LockupField({ control }: { control: Control<RewardFormValues> }) {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            <InfoBanner>{t("campaigns.create.reward.lockup.info")}</InfoBanner>
            <Stack space="xs">
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    className={styles.insetX}
                >
                    {t("campaigns.create.reward.lockup.durationLabel")}
                </Text>
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
                            ariaLabel={t(
                                "campaigns.create.reward.lockup.durationLabel"
                            )}
                        />
                    )}
                />
                <Text
                    variant="caption"
                    color="tertiary"
                    className={styles.insetX}
                >
                    {t("campaigns.create.reward.lockup.durationHint")}
                </Text>
            </Stack>
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

    const defaultValues = useMemo(() => draftToRewardForm(draft), [draft]);

    const form = useForm<RewardFormValues>({
        values: defaultValues,
        mode: "onChange",
    });

    // Field arrays for the tiered tables live here so the Global CPA table can
    // drive the Ambassador/Referee ranges (range-prefill sync).
    const ambassadorArray = useFieldArray({
        control: form.control,
        name: "ambassadorTiers",
    });
    const refereeArray = useFieldArray({
        control: form.control,
        name: "refereeTiers",
    });
    // Once the user edits a table's ranges, stop mirroring the Global ranges.
    const ambassadorRangesDirty = useRef(false);
    const refereeRangesDirty = useRef(false);

    const model = useWatch({ control: form.control, name: "model" });

    const watched = useWatch({ control: form.control });
    const isValid = isRewardFormValid({
        ...DEFAULT_REWARD_FORM,
        ...watched,
    } as RewardFormValues);

    async function persist(values: RewardFormValues) {
        const updated = rewardFormToDraft(values, { ...draft, merchantId });
        updateDraft(() => updated);
        return saveCampaign.mutateAsync(updated);
    }

    async function onSubmit(values: RewardFormValues) {
        const saved = await persist(values);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/validation",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(persist);

    return (
        <WizardStep
            stepKey="reward"
            formId={FORM_ID}
            isValid={isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={handleSaveDraft}
            onClose={() => form.reset(defaultValues)}
        >
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <Stack space="l">
                    <WizardFieldCard
                        space="xs"
                        label={t("campaigns.create.reward.campaignType.label")}
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
                                                className={styles.modelOption}
                                            >
                                                <RadioGroupItem
                                                    id={`model-${m.value}`}
                                                    value={m.value}
                                                    size="l"
                                                />
                                                <span
                                                    className={styles.modelMain}
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
                                    getValues={form.getValues}
                                    ambassadorArray={ambassadorArray}
                                    refereeArray={refereeArray}
                                    ambassadorRef={ambassadorRangesDirty}
                                    refereeRef={refereeRangesDirty}
                                />
                            )}
                        </Stack>
                    </WizardFieldCard>

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
    );
}
