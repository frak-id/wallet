import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { brandColors } from "@/styles/brand";

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
                backgroundColor: "#e8f8fd",
                color: brandColors.cerulean,
            },
            secondary: {
                backgroundColor: "#f0f1f3",
                color: brand.colors.neutral.grey500,
            },
            success: {
                backgroundColor: "#e7f4ee",
                color: "#0d894f",
            },
            danger: {
                backgroundColor: "#feedec",
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
                backgroundColor: "#fdf1e8",
                color: "#e46a11",
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
