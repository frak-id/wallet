import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { CalendarIcon } from "@frak-labs/design-system/icons";
import { getRouteApi } from "@tanstack/react-router";
import { parseISO } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/module/common/component/Calendar";
import {
    chip,
    chipActive,
    clearButton,
    panel,
    popoverContent,
    presetButton,
    presetButtonActive,
    presetColumn,
} from "./DateRangeChip.css";
import {
    DATE_RANGE_PRESETS,
    type DateRangePresetKey,
    formatRangeLabel,
    matchPreset,
    resolvePreset,
    toIso,
} from "./dateRangePresets";

// The chip only renders on the overview page (Header gates it via
// `showDateRange`), so binding to that route's API is safe.
const routeApi = getRouteApi("/_restricted/m/$merchantId/campaigns/overview");

function toDateRange(from?: string, to?: string): DateRange | undefined {
    if (!from) return undefined;
    return { from: parseISO(from), to: to ? parseISO(to) : undefined };
}

export function DateRangeChip() {
    const { from, to } = routeApi.useSearch();
    const navigate = routeApi.useNavigate();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<DateRange | undefined>(() =>
        toDateRange(from, to)
    );
    // false → next click starts a fresh range; true → next click sets the
    // end. Driving selection by click (rather than RDP's auto-range) lets a
    // single day be a valid range: click the same day twice.
    const [pickingEnd, setPickingEnd] = useState(false);

    const activePreset = matchPreset(from, to);
    const hasRange = Boolean(from && to);

    function commit(next: { from?: string; to?: string }) {
        navigate({
            search: (prev) => ({ ...prev, from: next.from, to: next.to }),
        });
    }

    function applyPreset(key: DateRangePresetKey) {
        const range = resolvePreset(key);
        setDraft(toDateRange(range.from, range.to));
        commit(range);
        setOpen(false);
    }

    function handleDayClick(day: Date) {
        if (!pickingEnd) {
            setDraft({ from: day, to: day });
            setPickingEnd(true);
            return;
        }
        const start = draft?.from ?? day;
        const [rangeFrom, rangeTo] =
            start.getTime() <= day.getTime() ? [start, day] : [day, start];
        setDraft({ from: rangeFrom, to: rangeTo });
        commit({ from: toIso(rangeFrom), to: toIso(rangeTo) });
        setPickingEnd(false);
        setOpen(false);
    }

    function clear() {
        setDraft(undefined);
        commit({ from: undefined, to: undefined });
        setOpen(false);
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                // Re-sync the calendar draft with the committed range each open
                // and start a fresh selection cycle.
                if (next) {
                    setDraft(toDateRange(from, to));
                    setPickingEnd(false);
                }
                setOpen(next);
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={hasRange ? `${chip} ${chipActive}` : chip}
                >
                    <CalendarIcon width={16} height={16} />
                    {formatRangeLabel(from, to)}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className={popoverContent}>
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
                                {preset.label}
                            </button>
                        ))}
                        {hasRange && (
                            <button
                                type="button"
                                className={clearButton}
                                onClick={clear}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <Calendar
                        mode="range"
                        selected={draft}
                        onDayClick={handleDayClick}
                        defaultMonth={draft?.from}
                        numberOfMonths={1}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
