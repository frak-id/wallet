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
    color: brand.colors.neutral.grey700,
});

export const budgetValue = style({
    fontSize: "0.875rem",
    fontWeight: brand.typography.fontWeight.medium,
    color: brand.colors.primary[500],
});

export const budgetDivider = style({
    borderTop: `1px dashed ${brand.colors.neutral.grey200}`,
    margin: "0.5rem 0",
});

export const periodGroup = style({
    marginTop: alias.spacing.xs,
});

export const periodItem = style({
    minWidth: "auto",
});
