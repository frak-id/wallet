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
 * Fraction → flex-grow share (the numerator), not an absolute width: a column
 * renders at `numerator / (sum of the row's numerators)`. It only equals the
 * written fraction in a complete single-denominator row (`1/3 + 2/3`); a lone
 * `1/4` fills the row and `1/2 + 1/3` splits 50/50.
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
 * Widths use inline `style` because the `flex` shorthand is incompatible with
 * class-based sprinkles. `flex-basis: 0` + `min-width: 0` make the shares
 * gap-aware, so the parent `Columns` gutter is subtracted before the split.
 */
export function Column({ width, children }: ColumnProps) {
    if (width === "content") {
        return <Box flexShrink={0}>{children}</Box>;
    }

    const grow = width !== undefined ? widthToGrow[width] : 1;
    const style: CSSProperties = { flex: `${grow} 1 0%`, minWidth: 0 };
    return <Box style={style}>{children}</Box>;
}
