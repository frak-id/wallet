import clsx from "clsx";
import type { ReactNode } from "react";
import type { ResponsiveSpace } from "../../sprinkles.css";
import { Box } from "../Box";
import * as styles from "./index.css";

type ValidSpreadElement =
    | "div"
    | "section"
    | "nav"
    | "header"
    | "footer"
    | "ul"
    | "ol"
    | "li"
    | "article"
    | "aside";

type SpreadAlign = "top" | "center" | "bottom";
type AlignItems = "flex-start" | "center" | "flex-end";

const alignToFlexAlign: Record<SpreadAlign, AlignItems> = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end",
} as const;

export type SpreadProps = {
    /** Minimum gap between the two slots. Uses the DS spacing scale. */
    space?: ResponsiveSpace;
    /** Main-axis direction. Defaults to "horizontal". */
    direction?: "horizontal" | "vertical";
    /** Cross-axis alignment. Defaults to "center". */
    align?: SpreadAlign;
    as?: ValidSpreadElement;
    className?: string;
    children?: ReactNode;
};

export function Spread({
    space,
    direction = "horizontal",
    align = "center",
    as = "div",
    className,
    children,
}: SpreadProps) {
    return (
        <Box
            as={as}
            display="flex"
            flexDirection={direction === "vertical" ? "column" : undefined}
            justifyContent="space-between"
            alignItems={alignToFlexAlign[align]}
            gap={space}
            className={clsx(styles.spread, className)}
        >
            {children}
        </Box>
    );
}
