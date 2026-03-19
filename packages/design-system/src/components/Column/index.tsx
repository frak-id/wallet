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

/** Maps fraction strings to CSS flex shorthand (grow=0, shrink=0, basis=%) */
const widthToFlex: Record<Exclude<ColumnWidth, "content">, string> = {
    "1/2": "0 0 50%",
    "1/3": "0 0 33.333%",
    "2/3": "0 0 66.667%",
    "1/4": "0 0 25%",
    "3/4": "0 0 75%",
    "1/5": "0 0 20%",
    "2/5": "0 0 40%",
    "3/5": "0 0 60%",
} as const;

export type ColumnProps = {
    width?: ColumnWidth;
    children?: ReactNode;
};

/**
 * Column — child of <Columns />, controls its own width.
 *
 * - `width="content"` → natural width (flexShrink: 0)
 * - `width="1/2"` etc → explicit flex shorthand via style prop
 * - no width → fills remaining space (flexGrow: 1)
 *
 * Fractional widths use inline `style` because `flex: "0 0 50%"` is
 * incompatible with class-based sprinkles. The parent Columns provides
 * gap-based spacing — no negative margin hacks needed.
 */
export function Column({ width, children }: ColumnProps) {
    // "content" → natural width via flexShrink: 0
    if (width === "content") {
        return <Box flexShrink={0}>{children}</Box>;
    }

    // fraction width → explicit flex via style prop
    if (width !== undefined) {
        const style: CSSProperties = { flex: widthToFlex[width] };
        return <Box style={style}>{children}</Box>;
    }

    // no width → fill remaining space via flexGrow: 1
    return <Box flexGrow={1}>{children}</Box>;
}
