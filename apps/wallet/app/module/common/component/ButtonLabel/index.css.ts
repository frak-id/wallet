import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand, fontSize } from "@/tokens.css";

export const buttonLabel = style({
    fontSize: fontSize.xs,
    color: vars.text.secondary,
    lineHeight: "16px",
});

globalStyle(`${buttonLabel} > strong`, {
    color: vars.text.onAction,
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.regular,
    lineHeight: "19px",
});
