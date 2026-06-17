import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const badgeClickable = style({
    cursor: "pointer",
});

export const badgeDisabled = style({
    cursor: "not-allowed",
});

export const badgeVariants = recipe({
    base: {
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        borderRadius: alias.cornerRadius.full,
        fontWeight: brand.typography.fontWeight.semiBold,
        lineHeight: "20px",
    },
    variants: {
        variant: {
            primary: {
                backgroundColor: brand.colors.primary[100],
                color: brand.colors.primary[500],
            },
            secondary: {
                backgroundColor: brand.colors.neutral.grey200,
                color: brand.colors.neutral.grey500,
            },
            success: {
                backgroundColor: brand.colors.success[100],
                color: brand.colors.success[700],
            },
            danger: {
                backgroundColor: brand.colors.error[100],
                color: brand.colors.error[600],
            },
            information: {
                backgroundColor: brand.colors.primary[100],
                color: brand.colors.primary[500],
            },
            informationReverse: {
                background: brand.colors.primary[500],
                color: brand.colors.neutral.white,
            },
            warning: {
                backgroundColor: brand.colors.warning[100],
                color: brand.colors.warning[600],
            },
        },
        size: {
            none: { padding: 0 },
            small: { padding: "2px 6px", fontSize: "14px" },
            medium: { padding: `${alias.spacing.xxs} ${alias.spacing.s}` },
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "medium",
    },
});
