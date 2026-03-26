import { style } from "@vanilla-extract/css";
import { fontSize } from "../../tokens.css";

const base = style({
    margin: 0,
});

export const textStyles = {
    base,
    heading1: style([
        base,
        {
            fontSize: fontSize["3xl"],
            lineHeight: "38px",
        },
    ]),
    heading2: style([
        base,
        {
            fontSize: fontSize.xl,
            lineHeight: "30px",
        },
    ]),
    heading3: style([
        base,
        {
            fontSize: fontSize.l,
            lineHeight: "26px",
        },
    ]),
    heading4: style([
        base,
        {
            fontSize: fontSize.m,
            lineHeight: "24px",
        },
    ]),
    heading5: style([
        base,
        {
            fontSize: fontSize.s,
            lineHeight: "20px",
        },
    ]),
    heading6: style([
        base,
        {
            fontSize: fontSize.xs,
            lineHeight: "18px",
        },
    ]),
    body: style([
        base,
        {
            fontSize: fontSize.m,
            lineHeight: "26px",
        },
    ]),
    bodySmall: style([
        base,
        {
            fontSize: fontSize.s,
            lineHeight: "22px",
        },
    ]),
    caption: style([
        base,
        {
            fontSize: fontSize.xs,
            lineHeight: "20px",
        },
    ]),
    label: style([
        base,
        {
            fontSize: fontSize.s,
            lineHeight: 1.3,
        },
    ]),
    overline: style([
        base,
        {
            fontSize: fontSize.xs,
            lineHeight: 1.4,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
        },
    ]),
};
