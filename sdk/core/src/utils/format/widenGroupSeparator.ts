/**
 * fr-FR groups digits with U+202F, which fonts like Inter draw about 0.12em
 * wide: `1 500` reads as `1500`. U+00A0 keeps the no-wrap and the gap.
 */
export function widenGroupSeparator(formatted: string): string {
    return formatted.replaceAll("\u202f", "\u00a0");
}
