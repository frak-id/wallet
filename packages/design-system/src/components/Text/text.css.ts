import { style } from "@vanilla-extract/css";
import { brand, fontSize } from "../../tokens.css";

const base = style({
    margin: 0,
    fontFamily: brand.typography.fontFamily.inter,
});

export const textStyles = {
    base,
    heading1: style([
        base,
        {
            fontSize: fontSize["5xl"],
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.3,
        },
    ]),
    heading2: style([
        base,
        {
            fontSize: fontSize["4xl"],
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.3,
        },
    ]),
    heading3: style([
        base,
        {
            fontSize: fontSize["3xl"],
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.3,
        },
    ]),
    heading4: style([
        base,
        {
            fontSize: fontSize["2xl"],
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.4,
        },
    ]),
    heading5: style([
        base,
        {
            fontSize: fontSize.xl,
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.4,
        },
    ]),
    heading6: style([
        base,
        {
            fontSize: fontSize.l,
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.4,
        },
    ]),
    body: style([
        base,
        {
            fontSize: fontSize.m,
            fontWeight: brand.typography.fontWeight.regular,
            lineHeight: 1.5,
        },
    ]),
    bodySmall: style([
        base,
        {
            fontSize: fontSize.s,
            fontWeight: brand.typography.fontWeight.regular,
            lineHeight: 1.5,
        },
    ]),
    caption: style([
        base,
        {
            fontSize: fontSize.xs,
            fontWeight: brand.typography.fontWeight.regular,
            lineHeight: 1.4,
        },
    ]),
    label: style([
        base,
        {
            fontSize: fontSize.s,
            fontWeight: brand.typography.fontWeight.medium,
            lineHeight: 1.3,
        },
    ]),
    overline: style([
        base,
        {
            fontSize: fontSize.xs,
            fontWeight: brand.typography.fontWeight.semiBold,
            lineHeight: 1.4,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
        },
    ]),
};
