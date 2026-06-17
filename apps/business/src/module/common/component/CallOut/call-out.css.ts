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
                backgroundColor: brandColors.ceruleanBackground,
                color: brandColors.cerulean,
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
            warning: {
                backgroundColor: brand.colors.warning[100],
                color: brand.colors.warning[600],
            },
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});
