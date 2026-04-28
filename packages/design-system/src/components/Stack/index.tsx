import type { ReactNode } from "react";
import type { ResponsiveSpace } from "../../sprinkles.css";
import { Box } from "../Box";

type ValidStackElement =
    | "div"
    | "span"
    | "section"
    | "nav"
    | "ul"
    | "ol"
    | "li"
    | "article"
    | "aside"
    | "main"
    | "details";
type StackAlign = "left" | "center" | "right";
type StackJustify = "start" | "center" | "end" | "space-between";

type AlignItems = "flex-start" | "center" | "flex-end";
type JustifyContent = "flex-start" | "center" | "flex-end" | "space-between";
type TextAlign = "left" | "center" | "right";

const alignToFlexAlign: Record<StackAlign, AlignItems> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
} as const;

const alignToTextAlign: Record<StackAlign, TextAlign> = {
    left: "left",
    center: "center",
    right: "right",
} as const;

const justifyToFlexJustify: Record<StackJustify, JustifyContent> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    "space-between": "space-between",
} as const;

export type StackProps = {
    space: ResponsiveSpace;
    padding?: ResponsiveSpace;
    paddingX?: ResponsiveSpace;
    paddingY?: ResponsiveSpace;
    align?: StackAlign;
    justify?: StackJustify;
    as?: ValidStackElement;
    className?: string;
    children?: ReactNode;
};

export function Stack({
    space,
    padding,
    paddingX,
    paddingY,
    align,
    justify,
    as = "div",
    className,
    children,
}: StackProps) {
    return (
        <Box
            as={as}
            display="flex"
            flexDirection="column"
            gap={space}
            padding={padding}
            paddingX={paddingX}
            paddingY={paddingY}
            alignItems={align ? alignToFlexAlign[align] : undefined}
            justifyContent={justify ? justifyToFlexJustify[justify] : undefined}
            textAlign={align ? alignToTextAlign[align] : undefined}
            className={className}
        >
            {children}
        </Box>
    );
}
