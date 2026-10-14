import { FieldLabel } from "@frak-labs/design-system/components/FieldLabel";
import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowRightIcon, DeleteIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InputNumber } from "@/module/forms/InputNumber";
import { useCurrencyGlyph } from "./currencyGlyph";
import * as styles from "./reward.css";
import { NumberStepper, UnitIcon, type UnitKind } from "./StepperField";
import type { RewardFormValues } from "./utils";

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
export function TierCard({
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
