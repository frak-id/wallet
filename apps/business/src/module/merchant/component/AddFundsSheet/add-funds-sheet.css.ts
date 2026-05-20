import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
});

export const sectionTitle = style({
    margin: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: vars.text.secondary,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
});

export const sectionBody = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    marginTop: alias.spacing.xs,
});

export const balanceRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.m,
    fontSize: "14px",
});

export const balanceLabel = style({
    color: vars.text.secondary,
});

export const balanceValue = style({
    color: vars.text.primary,
    fontWeight: 500,
    fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
});

export const paymentOptions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
});
