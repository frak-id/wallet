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

type AlignItems = "flex-start" | "center" | "flex-end";
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

export type StackProps = {
    space: ResponsiveSpace;
    align?: StackAlign;
    as?: ValidStackElement;
    children?: ReactNode;
};

export function Stack({ space, align, as = "div", children }: StackProps) {
    return (
        <Box
            as={as}
            display="flex"
            flexDirection="column"
            gap={space}
            alignItems={align ? alignToFlexAlign[align] : undefined}
            textAlign={align ? alignToTextAlign[align] : undefined}
        >
            {children}
        </Box>
    );
}
