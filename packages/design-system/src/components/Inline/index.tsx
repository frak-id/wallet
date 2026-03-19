import type { ReactNode } from "react";
import { Box } from "@/components/Box";
import type { ResponsiveSpace } from "@/sprinkles.css";

type ValidInlineElement = "div" | "span" | "nav" | "ul" | "ol" | "li";

type InlineAlign = "left" | "center" | "right";
type InlineAlignY = "top" | "center" | "bottom";

type JustifyContent = "flex-start" | "center" | "flex-end";
type AlignItems = "flex-start" | "center" | "flex-end";

const alignToJustifyContent: Record<InlineAlign, JustifyContent> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
} as const;

const alignYToFlexAlign: Record<InlineAlignY, AlignItems> = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end",
} as const;

export type InlineProps = {
    space: ResponsiveSpace;
    align?: InlineAlign;
    alignY?: InlineAlignY;
    as?: ValidInlineElement;
    children?: ReactNode;
};

export function Inline({
    space,
    align,
    alignY,
    as = "div",
    children,
}: InlineProps) {
    return (
        <Box
            as={as}
            display="flex"
            flexWrap="wrap"
            gap={space}
            justifyContent={align ? alignToJustifyContent[align] : undefined}
            alignItems={alignY ? alignYToFlexAlign[alignY] : undefined}
        >
            {children}
        </Box>
    );
}
