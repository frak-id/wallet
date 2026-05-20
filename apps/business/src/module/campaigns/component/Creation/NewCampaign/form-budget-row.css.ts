import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const budgetSection = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
});

export const budgetIconGroup = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
});

export const budgetIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const budgetLabel = style({
    fontSize: "0.875rem",
    fontWeight: brand.typography.fontWeight.regular,
    color: "#333843", // TODO: token
});

export const budgetValue = style({
    fontSize: "0.875rem",
    fontWeight: brand.typography.fontWeight.medium,
    color: "#5c59e8", // TODO: token
});

export const budgetDivider = style({
    borderTop: "1px dashed #f0f1f3", // TODO: token
    margin: "0.5rem 0",
});

export const periodGroup = style({
    marginTop: alias.spacing.xs,
});

export const periodItem = style({
    minWidth: "auto",
});
