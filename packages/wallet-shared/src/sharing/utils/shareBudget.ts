/**
 * Length budget for the share payload, in characters. Sized so the whole
 * `<scheme>://result?action=share&…` hand-off stays around 1.6 KB percent-encoded.
 * See docs/plans/native-sdk/10-native-share-payload.md §6.
 */
export const SHARE_BUDGET = {
    title: 120,
    text: 280,
    image: 512,
} as const;

const ELLIPSIS = "…";

/**
 * Splits on grapheme clusters where the runtime can, code points otherwise. A naive
 * `slice` cuts inside a surrogate pair or between a base character and its combining
 * mark, which renders as a replacement glyph or a stray accent.
 */
function graphemes(value: string): string[] {
    if (typeof Intl?.Segmenter === "function") {
        const segmenter = new Intl.Segmenter(undefined, {
            granularity: "grapheme",
        });
        return Array.from(segmenter.segment(value), (entry) => entry.segment);
    }
    return Array.from(value);
}

/**
 * Clips `value` to `max` characters, ellipsis included in the budget. Truncates rather
 * than rejecting: clipped copy still beats handing the OS a bare URL.
 */
export function truncateForShare(value: string, max: number): string {
    if (value.length <= max) return value;

    const units = graphemes(value);
    // Fast path: every grapheme is one UTF-16 unit, so the count is the length.
    if (units.length <= max) return value;

    let taken = "";
    for (const unit of units) {
        if (taken.length + unit.length > max - ELLIPSIS.length) break;
        taken += unit;
    }
    return `${taken.trimEnd()}${ELLIPSIS}`;
}
