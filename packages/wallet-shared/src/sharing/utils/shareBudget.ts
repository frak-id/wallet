/** Length budget for the share payload, in characters. */
export const SHARE_BUDGET = {
    title: 120,
    text: 280,
    image: 512,
} as const;

const ELLIPSIS = "…";

/** Grapheme clusters where available: a naive `slice` cuts inside a surrogate pair. */
function graphemes(value: string): string[] {
    if (typeof Intl?.Segmenter === "function") {
        const segmenter = new Intl.Segmenter(undefined, {
            granularity: "grapheme",
        });
        return Array.from(segmenter.segment(value), (entry) => entry.segment);
    }
    return Array.from(value);
}

/** Clips `value` to `max` characters, ellipsis included in the budget. */
export function truncateForShare(value: string, max: number): string {
    // The wire budget counts UTF-16 units, not graphemes: a ZWJ sequence must not slip past `max`.
    if (value.length <= max) return value;
    if (max <= ELLIPSIS.length) return value.slice(0, max);

    let taken = "";
    for (const unit of graphemes(value)) {
        if (taken.length + unit.length > max - ELLIPSIS.length) break;
        taken += unit;
    }
    return `${taken.trimEnd()}${ELLIPSIS}`;
}
