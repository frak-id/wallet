import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { brandColors } from "@/styles/brand";

const callOutBase = style({});

globalStyle(`${callOutBase} a`, {
    color: "inherit",
    textDecoration: "underline",
});

globalStyle(`${callOutBase} + ${callOutBase}`, {
    marginTop: alias.spacing.s,
});

export const callOutVariants = recipe({
    base: [
        callOutBase,
        {
            padding: alias.spacing.s,
            borderRadius: alias.cornerRadius.s,
            fontWeight: brand.typography.fontWeight.semiBold,
            lineHeight: "20px",
        },
    ],
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
            warning: {
                backgroundColor: "#fdf1e8",
                color: "#e46a11",
            },
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});
