import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const labelRow = style({
    paddingInline: alias.spacing.m,
});

export const hintRow = style({
    paddingInline: alias.spacing.m,
});

export const checkIcon = style({
    color: vars.icon.success,
    flexShrink: 0,
});

export const clearButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: vars.icon.primary,
});
