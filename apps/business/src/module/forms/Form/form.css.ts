import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const formItem = recipe({
    base: {},
    variants: {
        variant: {
            checkbox: {
                display: "flex",
                gap: alias.spacing.xs,
                borderRadius: alias.cornerRadius.xs,
            },
        },
    },
});

export const formLabel = recipe({
    base: {
        paddingBottom: alias.spacing.xxs,
        fontWeight: brand.typography.fontWeight.bold,
        color: brand.colors.neutral.grey600,
        whiteSpace: "nowrap",
        selectors: {
            '&[aria-disabled="true"]': {
                opacity: 0.5,
                cursor: "not-allowed",
            },
        },
    },
    variants: {
        variant: {
            checkbox: {
                color: brand.colors.neutral.grey500,
                lineHeight: "20px",
                fontWeight: brand.typography.fontWeight.medium,
            },
            light: {
                fontWeight: brand.typography.fontWeight.medium,
                color: vars.text.tertiary,
            },
            /** Quiet field label matching the design-system Input label. */
            field: {
                paddingBottom: 0,
                fontSize: fontSize.s,
                lineHeight: "22px",
                fontWeight: brand.typography.fontWeight.medium,
                color: vars.text.secondary,
                whiteSpace: "normal",
            },
        },
        selected: {
            true: { color: `${brand.colors.primary[500]} !important` },
        },
        weight: {
            medium: { fontWeight: brand.typography.fontWeight.medium },
        },
    },
});

export const formDescription = style({
    paddingBottom: "10px",
    fontSize: "16px",
});

export const formTitle = style({
    fontSize: "16px",
});

// Checkbox spacing
globalStyle(
    `${formItem.classNames.variants.variant.checkbox} + ${formItem.classNames.variants.variant.checkbox}`,
    {
        marginTop: "7px",
    }
);
