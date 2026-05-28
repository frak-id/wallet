import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const dot = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});

export const legendItem = style({
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xxs,
    padding: `${alias.spacing.xxs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.m,
    transition: "background-color 150ms ease, opacity 150ms ease",
});

export const legendItemActive = style({
    backgroundColor: vars.surface.secondary,
});

export const legendItemDimmed = style({
    opacity: 0.5,
});
