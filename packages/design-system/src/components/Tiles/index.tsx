import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import type { ResponsiveSpace } from "../../sprinkles.css";
import { Box } from "../Box";
import * as styles from "./index.css";

type ValidTilesElement =
    | "div"
    | "section"
    | "ol"
    | "ul"
    | "li"
    | "nav"
    | "article"
    | "aside";

type ResponsiveColumns =
    | number
    | { mobile?: number; tablet?: number; desktop?: number };

export type TilesProps = {
    /**
     * Number of equal-width columns. A bare number applies at all breakpoints.
     * An object enables per-breakpoint control with mobile-first carry-forward
     * (tablet defaults to mobile; desktop defaults to tablet).
     * Defaults to 1.
     */
    columns?: ResponsiveColumns;
    /** Gap between tiles. Uses the DS spacing scale. Defaults to "none". */
    space?: ResponsiveSpace;
    as?: ValidTilesElement;
    /**
     * Extra classes, appended after the grid class. If an override must outrank
     * the grid `display`/`grid-template-columns`, use `&&` specificity.
     */
    className?: string;
    children?: ReactNode;
};

export function Tiles({
    columns = 1,
    space = "none",
    as = "div",
    className,
    children,
}: TilesProps) {
    // Resolve per-breakpoint column counts with mobile-first carry-forward.
    const mobileCols =
        typeof columns === "number" ? columns : (columns.mobile ?? 1);
    const tabletCols =
        typeof columns === "number" ? columns : (columns.tablet ?? mobileCols);
    const desktopCols =
        typeof columns === "number" ? columns : (columns.desktop ?? tabletCols);

    return (
        <Box
            as={as}
            display="grid"
            gap={space}
            className={clsx(styles.tilesGrid, className)}
            style={
                {
                    "--tiles-cols-mobile": String(mobileCols),
                    "--tiles-cols-tablet": String(tabletCols),
                    "--tiles-cols-desktop": String(desktopCols),
                } as CSSProperties
            }
        >
            {children}
        </Box>
    );
}
