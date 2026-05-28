import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { parseISO, startOfMonth } from "date-fns";
import { type ReactNode, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/module/common/component/Calendar";
import {
    clearButton,
    panel,
    popoverContent,
    presetButton,
    presetButtonActive,
    presetColumn,
} from "./date-range-popover.css";
import {
    DATE_RANGE_PRESETS,
    type DateRangePresetKey,
    matchPreset,
    resolvePreset,
    toIso,
} from "./presets";

type DateRangePopoverProps = {
    /** Committed range (controlled by the parent). */
    value?: DateRange;
    onChange: (range: DateRange | undefined) => void;
    /** The button rendered as the popover trigger (styled by the caller). */
    trigger: ReactNode;
    align?: "start" | "center" | "end";
    numberOfMonths?: number;
    /** Raise z-index above a fixed header overlapping the popover. */
    liftAboveHeader?: boolean;
};

/**
 * Presentational range picker: a presets column + a range Calendar in a
 * popover. Selection is controlled by the parent via `value`/`onChange`;
 * the parent owns where the range is persisted (URL params, table filter,
 * etc.) and the trigger's styling/label.
 */
export function DateRangePopover({
    value,
    onChange,
    trigger,
    align = "start",
    numberOfMonths = 2,
    liftAboveHeader = false,
}: DateRangePopoverProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<DateRange | undefined>(value);
    // Controlled displayed month, normalised to the first of the month so the
    // two-month layout renders correctly; scrolls to a preset's start.
    const [month, setMonth] = useState<Date | undefined>(() =>
        value?.from ? startOfMonth(value.from) : undefined
    );

    const activePreset = matchPreset(
        value?.from ? toIso(value.from) : undefined,
        value?.to ? toIso(value.to) : undefined
    );
    const hasRange = Boolean(value?.from && value?.to);

    function applyPreset(key: DateRangePresetKey) {
        const range = resolvePreset(key);
        const next = { from: parseISO(range.from), to: parseISO(range.to) };
        setDraft(next);
        setMonth(startOfMonth(next.from));
        onChange(next);
    }

    function handleSelect(range: DateRange | undefined) {
        setDraft(range);
        onChange(range);
    }

    function clear() {
        setDraft(undefined);
        onChange(undefined);
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                // Re-sync the calendar draft + month with the committed value
                // each time the popover opens.
                if (next) {
                    setDraft(value);
                    setMonth(startOfMonth(value?.from ?? new Date()));
                }
                setOpen(next);
            }}
        >
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                align={align}
                className={liftAboveHeader ? popoverContent : undefined}
            >
                <div className={panel}>
                    <div className={presetColumn}>
                        {DATE_RANGE_PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                className={
                                    activePreset === preset.key
                                        ? `${presetButton} ${presetButtonActive}`
                                        : presetButton
                                }
                                onClick={() => applyPreset(preset.key)}
                            >
                                {t(preset.labelKey)}
                            </button>
                        ))}
                        {hasRange && (
                            <button
                                type="button"
                                className={clearButton}
                                onClick={clear}
                            >
                                {t("common.dateRange.clear")}
                            </button>
                        )}
                    </div>
                    <Calendar
                        mode="range"
                        selected={draft}
                        onSelect={handleSelect}
                        month={month}
                        onMonthChange={setMonth}
                        numberOfMonths={numberOfMonths}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
