import type { ReactNode } from "react";
import type { Sprinkles } from "@/sprinkles.css";
import { Box } from "../Box";
import { textStyles } from "./text.css";

type TextVariant =
    | "heading1"
    | "heading2"
    | "heading3"
    | "heading4"
    | "body"
    | "bodySmall"
    | "caption"
    | "label"
    | "overline";

const defaultTagMap: Record<TextVariant, string> = {
    heading1: "h1",
    heading2: "h2",
    heading3: "h3",
    heading4: "h4",
    body: "p",
    bodySmall: "p",
    caption: "span",
    label: "label",
    overline: "span",
};

type TextProps = {
    variant?: TextVariant;
    color?: Sprinkles["color"];
    align?: Sprinkles["textAlign"];
    as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "label";
    children?: ReactNode;
    className?: string;
};

export function Text({
    variant = "body",
    color,
    align,
    as,
    children,
    className,
}: TextProps) {
    const tag = (as ?? defaultTagMap[variant]) as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "p"
        | "span"
        | "label";
    const variantClass = textStyles[variant];

    return (
        <Box
            as={tag}
            color={color}
            textAlign={align}
            className={
                [variantClass, className].filter(Boolean).join(" ") || undefined
            }
        >
            {children}
        </Box>
    );
}
