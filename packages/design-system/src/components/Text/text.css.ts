import { style } from "@vanilla-extract/css";
import { brand, fontSize } from "../../tokens.css";

const base = style({
    margin: 0,
});

export const textStyles = {
    base,
    heading1: style([
        base,
        {
            fontSize: fontSize["3xl"],
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            fontFamily: brand.typography.fontFamily.interTight,
        },
    ]),
    heading2: style([
        base,
        {
            fontSize: fontSize["2xl"],
            fontWeight: brand.typography.fontWeight.bold,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            fontFamily: brand.typography.fontFamily.interTight,
        },
    ]),
    heading3: style([
        base,
        {
            fontSize: fontSize.xl,
            fontWeight: brand.typography.fontWeight.semiBold,
            lineHeight: 1.3,
            fontFamily: brand.typography.fontFamily.interTight,
        },
    ]),
    heading4: style([
        base,
        {
            fontSize: fontSize.l,
            fontWeight: brand.typography.fontWeight.semiBold,
            lineHeight: 1.4,
            fontFamily: brand.typography.fontFamily.inter,
        },
    ]),
    body: style([
        base,
        {
            fontSize: fontSize.m,
            fontWeight: brand.typography.fontWeight.regular,
            lineHeight: 1.5,
            fontFamily: brand.typography.fontFamily.inter,
        },
    ]),
    bodySmall: style([
        base,
        {
            fontSize: fontSize.s,
            fontWeight: brand.typography.fontWeight.regular,
            lineHeight: 1.5,
            fontFamily: brand.typography.fontFamily.inter,
        },
    ]),
    caption: style([
        base,
        {
            fontSize: fontSize.xs,
            fontWeight: brand.typography.fontWeight.regular,
            lineHeight: 1.4,
            fontFamily: brand.typography.fontFamily.inter,
        },
    ]),
    label: style([
        base,
        {
            fontSize: fontSize.s,
            fontWeight: brand.typography.fontWeight.medium,
            lineHeight: 1.3,
            fontFamily: brand.typography.fontFamily.inter,
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
            fontFamily: brand.typography.fontFamily.inter,
        },
    ]),
};
