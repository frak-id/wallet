import { FieldError } from "@frak-labs/design-system/components/FieldError";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { CalendarIcon } from "@frak-labs/design-system/icons";
import clsx from "clsx";
import {
    format,
    isAfter,
    isBefore,
    isValid,
    parse,
    startOfDay,
} from "date-fns";
import { type ChangeEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/module/common/component/Calendar";
import * as styles from "./date-field.css";

type DateFieldProps = {
    value?: string;
    onChange: (iso: string | undefined) => void;
    /** Earliest selectable day (e.g. the chosen start date). */
    minDate?: Date;
    /** Latest selectable day (e.g. the chosen end date). */
    maxDate?: Date;
    /** Accessible name for the input (the field has no visible <label>). */
    ariaLabel?: string;
    disabled?: boolean;
    /** Fill the field with the error surface (form-level error, e.g. required). */
    error?: boolean;
    /** Message shown when `error` is set (e.g. "Select a start date"). */
    errorMessage?: string;
    /**
     * Message shown when a complete date is typed but rejected (impossible
     * date or outside the [minDate, maxDate] window) — the emitted value is
     * `undefined`, which alone wouldn't flag the field, so we detect it here.
     */
    invalidMessage?: string;
};

const DISPLAY_FORMAT = "dd/MM/yyyy";

/** Format raw keystrokes into a `dd/mm/yyyy` mask (digits only, slashes auto). */
function maskDate(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits.slice(0, 2);
    if (digits.length > 2) out += `/${digits.slice(2, 4)}`;
    if (digits.length > 4) out += `/${digits.slice(4, 8)}`;
    return out;
}

/** Parse a complete `dd/mm/yyyy` string to a Date, rejecting overflow (e.g. 31/02). */
function parseDate(text: string): Date | null {
    if (text.length !== 10) return null;
    const parsed = parse(text, DISPLAY_FORMAT, new Date());
    if (!isValid(parsed)) return null;
    // `parse` is lenient (31/02 → 03/03); round-trip to reject rolled-over dates.
    if (format(parsed, DISPLAY_FORMAT) !== text) return null;
    // `parse` inherits the time-of-day from the reference date; pin to local
    // midnight so typed dates match calendar picks (a day, not an instant).
    return startOfDay(parsed);
}

/**
 * Muted date field: type `dd/mm/yyyy` directly, or open the styled Calendar
 * via the icon. `minDate`/`maxDate` constrain both the typed value and the
 * picker (out-of-range typed dates emit `undefined` so the step stays invalid).
 */
export function DateField({
    value,
    onChange,
    minDate,
    maxDate,
    ariaLabel,
    disabled,
    error,
    errorMessage,
    invalidMessage,
}: DateFieldProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(
        value ? format(new Date(value), DISPLAY_FORMAT) : ""
    );

    // Reflect an externally-set value (calendar pick, draft load) into the
    // visible text. We never clear here: an empty/incomplete value is the user
    // mid-edit, and clobbering it would wipe their keystrokes on first delete.
    useEffect(() => {
        if (!value) return;
        const next = format(new Date(value), DISPLAY_FORMAT);
        setText((prev) => (prev === next ? prev : next));
    }, [value]);

    const selected = value ? new Date(value) : undefined;

    const outOfRange = (date: Date) =>
        (minDate ? isBefore(date, minDate) : false) ||
        (maxDate ? isAfter(date, maxDate) : false);

    const disabledDays =
        minDate || maxDate ? (date: Date) => outOfRange(date) : undefined;

    function handleInput(event: ChangeEvent<HTMLInputElement>) {
        const masked = maskDate(event.target.value);
        setText(masked);
        const parsed = parseDate(masked);
        onChange(
            parsed && !outOfRange(parsed) ? parsed.toISOString() : undefined
        );
    }

    function handlePick(date: Date | undefined) {
        // Normalize like the typed path so both emit a local-midnight instant.
        const day = date ? startOfDay(date) : undefined;
        onChange(day?.toISOString());
        setText(day ? format(day, DISPLAY_FORMAT) : "");
        setOpen(false);
    }

    // A complete date that produced no value was typed but rejected (impossible
    // or out of range). The form value is `undefined` either way, so the field
    // wouldn't otherwise flag it — surface it here.
    const invalidText = text.length === DISPLAY_FORMAT.length && !value;
    const showError = Boolean(error) || invalidText;
    const message = invalidText ? invalidMessage : error ? errorMessage : null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Stack space="xxs">
                <div
                    className={clsx(
                        styles.dateField,
                        showError && styles.dateFieldError,
                        disabled && styles.dateFieldDisabled
                    )}
                >
                    <input
                        type="text"
                        inputMode="numeric"
                        aria-label={ariaLabel}
                        aria-invalid={showError || undefined}
                        disabled={disabled}
                        className={styles.dateInput}
                        placeholder={t("common.dateField.placeholder")}
                        value={text}
                        onChange={handleInput}
                    />
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={disabled}
                            aria-label={t("common.dateField.openCalendar")}
                            className={styles.dateIconButton}
                        >
                            <CalendarIcon
                                width={20}
                                height={20}
                                className={styles.dateIcon}
                            />
                        </button>
                    </PopoverTrigger>
                </div>
                <FieldError>{message}</FieldError>
            </Stack>
            <PopoverContent align="end">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={handlePick}
                    disabled={disabledDays}
                />
            </PopoverContent>
        </Popover>
    );
}
