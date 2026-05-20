import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const budgetUsageItem = style({
    padding: alias.spacing.s,
    background: brand.colors.neutral.grey50,
    border: `1px solid ${brand.colors.neutral.grey250}`,
    borderRadius: alias.cornerRadius.s,
});

export const budgetUsageLabel = style({
    fontWeight: brand.typography.fontWeight.semiBold,
    fontSize: "14px",
    color: brand.colors.neutral.grey800,
    textTransform: "capitalize",
});

export const budgetUsageBar = style({
    width: "100%",
    height: "6px",
    background: brand.colors.neutral.grey250,
    borderRadius: "3px",
    overflow: "hidden",
});

export const budgetUsageBarFill = style({
    height: "100%",
    background: brand.colors.primary[600],
    borderRadius: "3px",
    transition: "width 0.3s ease",
});

export const budgetUsageFooter = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "6px",
});

export const budgetUsageReset = style({
    fontSize: "12px",
    color: brand.colors.neutral.grey600,
    fontStyle: "italic",
});
