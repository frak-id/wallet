import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

/**
 * Hint row, inset 16px so the text lines up with a field's inner text (the
 * borderless inputs pad their content by `spacing.m`).
 */
export const root = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    paddingInline: alias.spacing.m,
});

export const icon = style({
    color: vars.icon.error,
    flexShrink: 0,
});

export const message = style({
    color: vars.text.error,
    fontSize: "12px",
    lineHeight: "20px",
});
