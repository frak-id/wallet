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

export const suggestionList = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.xs,
});

export const suggestionPill = style({
    display: "inline-flex",
    alignItems: "center",
    height: "36px",
    paddingInline: alias.spacing.m,
    paddingBlock: alias.spacing.xs,
    borderRadius: alias.cornerRadius.m,
    border: "none",
    background: vars.surface.elevated,
    color: vars.text.primary,
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "22px",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    selectors: {
        "&:not(:disabled):hover": {
            background: vars.surface.secondaryHover,
        },
    },
});

export const suggestionPillSelected = style({
    background: vars.surface.secondaryPressed,
    color: vars.text.primary,
});
