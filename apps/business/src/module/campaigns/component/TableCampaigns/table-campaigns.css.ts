import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const tableBudgetAmount = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
});

export const tableBudgetType = style({
    fontSize: "12px",
    color: vars.text.tertiary,
});

export const tableActions = style({
    display: "flex",
    gap: alias.spacing.xs,
    alignItems: "center",
});

globalStyle(`${tableActions} button, ${tableActions} a`, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: alias.spacing.xxs,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: vars.icon.tertiary,
    transition: "color 0.2s",
    textDecoration: "none",
});

globalStyle(`${tableActions} button:hover, ${tableActions} a:hover`, {
    color: vars.icon.primary,
});
