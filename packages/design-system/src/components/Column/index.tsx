import type { CSSProperties, ReactNode } from "react";
import { Box } from "../Box";

type ColumnWidth =
    | "content"
    | "1/2"
    | "1/3"
    | "2/3"
    | "1/4"
    | "3/4"
    | "1/5"
    | "2/5"
    | "3/5";

/**
 * Maps each fraction to its flex-grow share (the numerator).
 *
 * IMPORTANT — widths are proportional *grow shares*, not absolute fractions.
 * Each fraction contributes its numerator as a flex-grow weight over a zero
 * basis, so a column's rendered width is `numerator / (sum of the row's
 * numerators)`. This only equals the written fraction when the columns in a
 * row share one denominator and sum to a whole, e.g. `1/2 + 1/2`, `1/3 + 2/3`,
 * `1/4 + 1/4 + 1/4 + 1/4`, `2/5 + 3/5`. Consequences of misuse:
 *   - a lone `<Column width="1/4">` fills the whole row (share 1 of 1),
 *   - mixed denominators (`1/2 + 1/3`) split by numerators (1:1 → 50/50),
 *     NOT by the literal fractions.
 * This is the gap-native trade-off vs Braid's percentage-basis model: it keeps
 * rows from overflowing by the `Columns` gutter, at the cost of fractions only
 * being honoured within a complete, single-denominator row.
 */
const widthToGrow: Record<Exclude<ColumnWidth, "content">, number> = {
    "1/2": 1,
    "1/3": 1,
    "2/3": 2,
    "1/4": 1,
    "3/4": 3,
    "1/5": 1,
    "2/5": 2,
    "3/5": 3,
} as const;

export type ColumnProps = {
    width?: ColumnWidth;
    children?: ReactNode;
};

/**
 * Column — child of <Columns />, controls its own width.
 *
 * - `width="content"` → natural width (flexShrink: 0)
 * - `width="1/2"` etc → proportional grow share — pair fractions that sum to a
 *   whole within a row (see `widthToGrow` above); they are NOT absolute widths
 * - no width → fills remaining space (one share)
 *
 * Widths use inline `style` because the `flex` shorthand is incompatible with
 * class-based sprinkles. `flex-basis: 0` + `min-width: 0` make the fractions
 * gap-aware: the parent `Columns` gap is subtracted first, then the remaining
 * width is split by each column's grow share — so `1/2 + 1/2` is a true 50/50
 * with the gutter and never overflows.
 */
export function Column({ width, children }: ColumnProps) {
    // "content" → natural width via flexShrink: 0
    if (width === "content") {
        return <Box flexShrink={0}>{children}</Box>;
    }

    // fraction (or fill) → proportional grow with a zero basis
    const grow = width !== undefined ? widthToGrow[width] : 1;
    const style: CSSProperties = { flex: `${grow} 1 0%`, minWidth: 0 };
    return <Box style={style}>{children}</Box>;
}
