/** Length budget for the share payload, in characters. */
export const SHARE_BUDGET = {
    title: 120,
    text: 280,
    image: 512,
} as const;

const ELLIPSIS = "…";

/** Grapheme clusters where available: a naive `slice` cuts inside a surrogate pair. */
function* graphemes(value: string): Generator<string> {
    if (typeof Intl?.Segmenter === "function") {
        const segmenter = new Intl.Segmenter(undefined, {
            granularity: "grapheme",
        });
        for (const { segment } of segmenter.segment(value)) yield segment;
        return;
    }
    yield* value;
}

/** Clips `value` to `max` characters, ellipsis included in the budget. */
export function truncateForShare(value: string, max: number): string {
    // The wire budget counts UTF-16 units, not graphemes: a ZWJ sequence must not slip past `max`.
    if (value.length <= max) return value;

    // Under the ellipsis' own width there is no room to mark the cut, so the result is
    // whole graphemes and nothing else: slicing to `max` would emit a lone surrogate.
    const marked = max > ELLIPSIS.length;
    const budget = marked ? max - ELLIPSIS.length : max;

    let taken = "";
    for (const unit of graphemes(value)) {
        if (taken.length + unit.length > budget) break;
        taken += unit;
    }
    return marked ? `${taken.trimEnd()}${ELLIPSIS}` : taken;
}
