import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const tableBudgetAmount = style({
    fontSize: "0.875rem",
    fontWeight: brand.typography.fontWeight.medium,
    color: "#333843", // TODO: token
});

export const tableBudgetType = style({
    fontSize: "0.75rem",
    color: "#818c9c", // TODO: token
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
    color: "#818c9c !important", // TODO: token
    transition: "color 0.2s",
    textDecoration: "none",
});

globalStyle(`${tableActions} button:hover, ${tableActions} a:hover`, {
    color: "#333843 !important", // TODO: token
});
