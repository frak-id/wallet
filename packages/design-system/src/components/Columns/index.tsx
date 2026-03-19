import type { ReactNode } from "react";
import { Box } from "@/components/Box";
import type { ResponsiveSpace } from "@/sprinkles.css";

type ValidColumnsElement = "div" | "section" | "nav" | "ul" | "ol";

type ColumnsAlignY = "top" | "center" | "bottom";
type AlignItems = "flex-start" | "center" | "flex-end";

const alignYToFlexAlign: Record<ColumnsAlignY, AlignItems> = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end",
} as const;

export type ColumnsProps = {
    space: ResponsiveSpace;
    alignY?: ColumnsAlignY;
    as?: ValidColumnsElement;
    children?: ReactNode;
};

/**
 * Columns — horizontal layout with gap-based spacing.
 *
 * Wraps <Column /> children in a flex row with responsive gap.
 * Uses CSS `gap` (no negative margin hacks). Vertical alignment
 * via `alignY` maps to flexbox `align-items`.
 */
export function Columns({ space, alignY, as = "div", children }: ColumnsProps) {
    return (
        <Box
            as={as}
            display="flex"
            flexDirection="row"
            gap={space}
            alignItems={alignY ? alignYToFlexAlign[alignY] : undefined}
        >
            {children}
        </Box>
    );
}
