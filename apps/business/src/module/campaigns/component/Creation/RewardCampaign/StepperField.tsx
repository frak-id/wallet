import { Inline } from "@frak-labs/design-system/components/Inline";
import { DoubleChevronIcon, PercentIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { InputNumber } from "@/module/forms/InputNumber";
import { useCurrencyGlyph } from "./currencyGlyph";
import * as styles from "./reward.css";
import type { RewardFormValues } from "./utils";

export type UnitKind = "amount" | "percent";

export function UnitIcon({ unit }: { unit: UnitKind }) {
    const glyph = useCurrencyGlyph();
    if (unit === "percent") {
        return (
            <PercentIcon width={24} height={24} className={styles.unitIcon} />
        );
    }
    return <span className={styles.unitGlyph}>{glyph}</span>;
}

/** Double-chevron stepper: one glyph with two transparent hit zones. */
export function NumberStepper({
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
export function StepperField({
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
