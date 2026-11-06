import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const balanceLayout = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.l,
    paddingTop: alias.spacing.l,
    paddingBottom: "20px",
});

export const balanceCardHeader = style({
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    width: "100%",
});

export const eyeIcon = style({
    color: vars.icon.secondary,
});

export const amountContainer = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    fontVariantNumeric: "tabular-nums",
});

export const amountInteger = style({
    fontSize: fontSize["5xl"],
    fontWeight: 700,
    color: vars.text.primary,
    lineHeight: 1,
});

export const amountDecimals = style({
    fontSize: fontSize["5xl"],
    fontWeight: 700,
    color: vars.text.disabled,
    lineHeight: 1,
});

export const currencySuffix = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    marginLeft: alias.spacing.xxs,
});

export const statCardsRow = style({
    display: "flex",
    flexDirection: "row",
    gap: alias.spacing.xs,
    width: "100%",
});

export const statCardButton = style({
    display: "flex",
    flex: 1,
    minWidth: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
    textAlign: "left",
    transition: "transform 120ms ease",
    selectors: {
        "&:active": { transform: "scale(0.98)" },
    },
});
