import clsx from "clsx";
import type { ReactNode } from "react";
import type { Sprinkles } from "../../sprinkles.css";
import { Box } from "../Box";
import { textStyles } from "./text.css";

type TextVariant =
    | "heading1"
    | "heading2"
    | "heading3"
    | "heading4"
    | "heading5"
    | "heading6"
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
    heading5: "h5",
    heading6: "h6",
    body: "p",
    bodySmall: "p",
    caption: "span",
    label: "label",
    overline: "span",
};

const defaultWeightMap: Record<TextVariant, Sprinkles["fontWeight"]> = {
    heading1: "bold",
    heading2: "bold",
    heading3: "bold",
    heading4: "bold",
    heading5: "bold",
    heading6: "bold",
    body: "regular",
    bodySmall: "regular",
    caption: "regular",
    label: "medium",
    overline: "semiBold",
};

const tagToVariant: Partial<Record<string, TextVariant>> = {
    h1: "heading1",
    h2: "heading2",
    h3: "heading3",
    h4: "heading4",
    h5: "heading5",
    h6: "heading6",
};

type TextProps = {
    variant?: TextVariant;
    color?: Sprinkles["color"];
    weight?: Sprinkles["fontWeight"];
    align?: Sprinkles["textAlign"];
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "label";
    children?: ReactNode;
    className?: string;
};

export function Text({
    variant,
    color,
    weight,
    align,
    as,
    children,
    className,
}: TextProps) {
    const resolvedVariant = variant ?? (as && tagToVariant[as]) ?? "body";
    const tag = (as ?? defaultTagMap[resolvedVariant]) as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6"
        | "p"
        | "span"
        | "label";
    const variantClass = textStyles[resolvedVariant];

    return (
        <Box
            as={tag}
            color={color}
            fontWeight={weight ?? defaultWeightMap[resolvedVariant]}
            textAlign={align}
            className={clsx(variantClass, className) || undefined}
        >
            {children}
        </Box>
    );
}
