import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
});

export const label = style({
    fontSize: "12px",
    color: vars.text.secondary,
});

export const bar = style({
    display: "flex",
    height: "8px",
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
    gap: "2px",
    backgroundColor: vars.surface.muted,
});

export const segment = style({
    height: "100%",
});

export const legend = style({
    display: "flex",
    flexWrap: "wrap",
    gap: alias.spacing.s,
    rowGap: alias.spacing.xxs,
});

export const legendItem = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: vars.text.primary,
});

export const dot = style({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
});
