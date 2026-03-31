import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const pendingGains = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    alignItems: "center",
    textAlign: "center",
});

export const textGroup = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const amountBlock = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    padding: alias.spacing.m,
});

export const header = style({
    display: "flex",
    justifyContent: "flex-end",
});

export const amount = style({
    fontSize: fontSize["4xl"],
    fontWeight: 700,
    color: vars.text.success,
});

export const heading = style({
    whiteSpace: "pre-line",
});

export const confirmButton = style({
    width: "100%",
});
