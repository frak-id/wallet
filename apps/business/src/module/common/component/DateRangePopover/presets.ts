import { format, parseISO, startOfMonth, subDays } from "date-fns";
import type { Locale } from "date-fns/locale";
import type { TFunction } from "i18next";
import type { DateRange } from "react-day-picker";

export type DateRangePresetKey = "last7" | "last30" | "last90" | "thisMonth";

export type DateRangePreset = {
    key: DateRangePresetKey;
    labelKey: `common.dateRange.presets.${DateRangePresetKey}`;
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
    { key: "last7", labelKey: "common.dateRange.presets.last7" },
    { key: "last30", labelKey: "common.dateRange.presets.last30" },
    { key: "last90", labelKey: "common.dateRange.presets.last90" },
    { key: "thisMonth", labelKey: "common.dateRange.presets.thisMonth" },
];

export type IsoRange = { from: string; to: string };

const ISO = "yyyy-MM-dd";

export function toIso(date: Date): string {
    return format(date, ISO);
}

/** Parse a stored `yyyy-MM-dd` window into a calendar `DateRange`. */
export function isoToDateRange(
    from?: string,
    to?: string
): DateRange | undefined {
    if (!from) return undefined;
    return { from: parseISO(from), to: to ? parseISO(to) : undefined };
}

/** Resolve a preset to a concrete `{from, to}` window ending today (inclusive). */
export function resolvePreset(key: DateRangePresetKey): IsoRange {
    const today = new Date();
    const to = toIso(today);
    switch (key) {
        case "last7":
            return { from: toIso(subDays(today, 6)), to };
        case "last30":
            return { from: toIso(subDays(today, 29)), to };
        case "last90":
            return { from: toIso(subDays(today, 89)), to };
        case "thisMonth":
            return { from: toIso(startOfMonth(today)), to };
    }
}

/** Preset key whose resolved window matches the given range, if any. */
export function matchPreset(
    from?: string,
    to?: string
): DateRangePresetKey | undefined {
    if (!from || !to) return undefined;
    return DATE_RANGE_PRESETS.find((preset) => {
        const resolved = resolvePreset(preset.key);
        return resolved.from === from && resolved.to === to;
    })?.key;
}

/** Trigger label: preset name when the range matches one, else a formatted span. */
export function formatRangeLabel(
    from: string | undefined,
    to: string | undefined,
    t: TFunction,
    locale?: Locale
): string {
    if (!from || !to) return t("common.dateRange.label");

    const presetKey = matchPreset(from, to);
    if (presetKey) {
        const preset = DATE_RANGE_PRESETS.find((p) => p.key === presetKey);
        return preset ? t(preset.labelKey) : "";
    }

    if (from === to) return format(parseISO(from), "MMM d, yyyy", { locale });

    const fromDate = parseISO(from);
    const toDate = parseISO(to);
    const sameYear = fromDate.getFullYear() === toDate.getFullYear();
    const fromFmt = sameYear ? "MMM d" : "MMM d, yyyy";
    return `${format(fromDate, fromFmt, { locale })} – ${format(toDate, "MMM d, yyyy", { locale })}`;
}
