import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const balanceLayout = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.l,
    paddingBottom: "20px",
});

export const balanceCardHeader = style({
    display: "flex",
    flexDirection: "column",
    gap: "18px",
});

export const headerRow = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xs,
});

export const eyeIcon = style({
    cursor: "pointer",
    color: vars.icon.secondary,
    transition: "color 0.2s ease",
    ":hover": {
        color: vars.icon.primary,
    },
});

export const amountContainer = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
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
    ":focus": {
        outline: "none",
    },
    ":focus-visible": {
        outline: `2px solid ${vars.border.focus}`,
        outlineOffset: "2px",
    },
});
