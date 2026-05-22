import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const formItem = recipe({
    base: {
        marginBottom: "10px",
    },
    variants: {
        variant: {
            radio: {
                display: "inline-flex",
                alignItems: "center",
                gap: alias.spacing.xs,
                borderRadius: alias.cornerRadius.xs,
                padding: "7px",
            },
            checkbox: {
                display: "flex",
                gap: alias.spacing.xs,
                borderRadius: alias.cornerRadius.xs,
            },
        },
    },
});

export const formLayout = style({
    maxWidth: "850px",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
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
            radio: { paddingBottom: 0 },
            checkbox: {
                color: brand.colors.neutral.grey500,
                lineHeight: "20px",
                fontWeight: brand.typography.fontWeight.medium,
            },
            light: {
                fontWeight: brand.typography.fontWeight.medium,
                color: vars.text.tertiary,
            },
            dark: {},
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

export const formError = style({
    color: `${brand.colors.error[600]} !important`,
});

// Radio checked highlight
globalStyle(
    `${formItem.classNames.variants.variant.radio}:has(button[data-state="checked"])`,
    {
        background: "#818c9c24",
    }
);

// Checkbox spacing
globalStyle(
    `${formItem.classNames.variants.variant.checkbox} + ${formItem.classNames.variants.variant.checkbox}`,
    {
        marginTop: "7px",
    }
);
