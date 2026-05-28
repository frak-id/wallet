import { format, parseISO, startOfMonth, subDays } from "date-fns";

export type DateRangePresetKey = "last7" | "last30" | "last90" | "thisMonth";

export type DateRangePreset = {
    key: DateRangePresetKey;
    label: string;
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
    { key: "last7", label: "Last 7 days" },
    { key: "last30", label: "Last 30 days" },
    { key: "last90", label: "Last 90 days" },
    { key: "thisMonth", label: "This month" },
];

export type IsoRange = { from: string; to: string };

const ISO = "yyyy-MM-dd";

export function toIso(date: Date): string {
    return format(date, ISO);
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

/** Chip label: preset name when the range matches one, else a formatted span. */
export function formatRangeLabel(from?: string, to?: string): string {
    if (!from || !to) return "Date range";

    const presetKey = matchPreset(from, to);
    if (presetKey) {
        return DATE_RANGE_PRESETS.find((p) => p.key === presetKey)?.label ?? "";
    }

    if (from === to) return format(parseISO(from), "MMM d, yyyy");

    const fromDate = parseISO(from);
    const toDate = parseISO(to);
    const sameYear = fromDate.getFullYear() === toDate.getFullYear();
    const fromFmt = sameYear ? "MMM d" : "MMM d, yyyy";
    return `${format(fromDate, fromFmt)} – ${format(toDate, "MMM d, yyyy")}`;
}
