import type { ReactNode } from "react";
import type { ResponsiveSpace } from "../../sprinkles.css";
import { Box } from "../Box";
import * as styles from "./index.css";

type ValidInlineElement = "div" | "span" | "nav" | "ul" | "ol" | "li";
type InlineAlign = "left" | "center" | "right" | "space-between";
type InlineAlignY = "top" | "center" | "bottom" | "baseline";
type JustifyContent = "flex-start" | "center" | "flex-end" | "space-between";
type AlignItems = "flex-start" | "center" | "flex-end" | "baseline";

const alignToJustifyContent: Record<InlineAlign, JustifyContent> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
    "space-between": "space-between",
} as const;

const alignYToFlexAlign: Record<InlineAlignY, AlignItems> = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end",
    baseline: "baseline",
} as const;

export type InlineProps = {
    space: ResponsiveSpace;
    padding?: ResponsiveSpace;
    paddingX?: ResponsiveSpace;
    paddingY?: ResponsiveSpace;
    align?: InlineAlign;
    alignY?: InlineAlignY;
    fill?: boolean;
    wrap?: boolean;
    as?: ValidInlineElement;
    children?: ReactNode;
};

export function Inline({
    space,
    padding,
    paddingX,
    paddingY,
    align,
    alignY,
    fill,
    wrap = true,
    as = "div",
    children,
}: InlineProps) {
    return (
        <Box
            as={as}
            display="flex"
            flexWrap={fill ? undefined : wrap ? "wrap" : "nowrap"}
            gap={space}
            padding={padding}
            paddingX={paddingX}
            paddingY={paddingY}
            justifyContent={align ? alignToJustifyContent[align] : undefined}
            alignItems={alignY ? alignYToFlexAlign[alignY] : undefined}
            className={fill ? styles.fill : undefined}
        >
            {children}
        </Box>
    );
}
