import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.l,
    padding: alias.spacing.m,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    minWidth: 0,
});

export const headerRow = style({
    display: "flex",
    alignItems: "baseline",
    gap: alias.spacing.xs,
});

export const descriptor = style({
    fontSize: "12px",
    color: vars.text.tertiary,
});

export const amount = style({
    fontSize: "28px",
    lineHeight: "32px",
    fontWeight: 700,
    color: vars.text.primary,
    fontVariantNumeric: "tabular-nums",
});

export const delta = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    fontSize: "12px",
    fontWeight: 500,
});

export const deltaUp = style({ color: vars.text.success });
export const deltaDown = style({ color: vars.text.warning });
