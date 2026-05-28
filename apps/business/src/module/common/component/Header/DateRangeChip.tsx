import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { CalendarIcon } from "@frak-labs/design-system/icons";
import { getRouteApi } from "@tanstack/react-router";
import { parseISO, startOfMonth } from "date-fns";
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

function toDateRange(from?: string, to?: string): DateRange | undefined {
    if (!from) return undefined;
    return { from: parseISO(from), to: to ? parseISO(to) : undefined };
}

export function DateRangeChip() {
    // Resolved inside the component (not at module scope) so importing this
    // file doesn't call into the router. The chip only renders on the
    // overview page (Header gates it via `showDateRange`), so binding to that
    // route's API is safe.
    const routeApi = getRouteApi(
        "/_restricted/m/$merchantId/campaigns/overview"
    );
    const { from, to } = routeApi.useSearch();
    const navigate = routeApi.useNavigate();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<DateRange | undefined>(() =>
        toDateRange(from, to)
    );
    // Controlled displayed month so applying a preset scrolls the calendar
    // to the selected range (otherwise the highlight can sit off-screen).
    // Must be the first of a month for the two-month layout to render right.
    const [month, setMonth] = useState<Date | undefined>(() => {
        const start = toDateRange(from, to)?.from;
        return start ? startOfMonth(start) : undefined;
    });

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
        setMonth(startOfMonth(parseISO(range.from)));
        commit(range);
    }

    // Controlled selection (selected + onSelect) so RDP reflects programmatic
    // updates from presets. The popover stays open after committing
    // (shadcn behaviour); the user dismisses via outside-click or Esc.
    function handleSelect(range: DateRange | undefined) {
        setDraft(range);
        commit({
            from: range?.from ? toIso(range.from) : undefined,
            to: range?.to ? toIso(range.to) : undefined,
        });
    }

    function clear() {
        setDraft(undefined);
        commit({ from: undefined, to: undefined });
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                // Re-sync the calendar draft + displayed month with the
                // committed range each time the popover opens.
                if (next) {
                    const committed = toDateRange(from, to);
                    setDraft(committed);
                    setMonth(startOfMonth(committed?.from ?? new Date()));
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
                        onSelect={handleSelect}
                        month={month}
                        onMonthChange={setMonth}
                        numberOfMonths={2}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
