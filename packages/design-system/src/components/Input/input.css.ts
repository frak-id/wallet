import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, transition } from "../../tokens.css";

export const inputWrapper = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        color: vars.text.primary,
        overflow: "hidden",
    },
    variants: {
        variant: {
            /**
             * Standard bordered field — the default for most forms.
             */
            default: {
                borderRadius: alias.cornerRadius.s,
                border: `${alias.borderWidth.xs} solid ${vars.border.default}`,
                backgroundColor: vars.surface.background,
                transition: `border-color ${transition.base} ease`,
                selectors: {
                    "&:focus-within": {
                        borderColor: vars.border.focus,
                    },
                },
            },
            /**
             * Borderless 56px white card matching the Figma "flat" input
             * surface (e.g. Monerium recap note + IBAN form).
             */
            bare: {
                borderRadius: alias.cornerRadius.m,
                backgroundColor: vars.surface.elevated,
                height: "56px",
                paddingInline: alias.spacing.m,
                gap: alias.spacing.xs,
            },
        },
        length: {
            small: { width: "160px" },
            medium: { width: "320px" },
            big: { width: "100%" },
        },
        error: {
            true: {},
        },
        disabled: {
            true: {
                cursor: "not-allowed",
                opacity: 0.6,
            },
        },
    },
    compoundVariants: [
        {
            variants: { variant: "default", error: true },
            style: {
                borderColor: vars.border.error,
                selectors: {
                    "&:focus-within": {
                        borderColor: vars.border.error,
                    },
                },
            },
        },
        {
            variants: { variant: "default", disabled: true },
            style: {
                backgroundColor: vars.surface.disabled,
            },
        },
    ],
    defaultVariants: {
        variant: "default",
    },
});

export const inputField = recipe({
    base: {
        color: vars.text.primary,
        fontFamily: "inherit",
        backgroundColor: "transparent",
        selectors: {
            "&:disabled": {
                cursor: "not-allowed",
            },
        },
    },
    variants: {
        variant: {
            default: {
                width: "100%",
                padding: `${alias.spacing.xs} ${alias.spacing.m}`,
                fontSize: "16px",
                lineHeight: "20px",
                fontWeight: 400,
                "::placeholder": {
                    color: vars.text.tertiary,
                    opacity: 1,
                },
            },
            bare: {
                flex: "1 1 auto",
                minWidth: 0,
                border: "none",
                outline: "none",
                padding: 0,
                margin: 0,
                fontSize: "16px",
                lineHeight: "26px",
                fontWeight: 400,
                "::placeholder": {
                    color: vars.text.tertiary,
                },
            },
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export const inputSection = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
    },
    variants: {
        variant: {
            // Default keeps the inset paddings; bare's wrapper already pads.
            default: {},
            bare: {},
        },
        side: {
            left: {},
            right: {},
        },
    },
    compoundVariants: [
        {
            variants: { variant: "default", side: "left" },
            style: { paddingLeft: alias.spacing.m },
        },
        {
            variants: { variant: "default", side: "right" },
            style: { paddingRight: alias.spacing.m },
        },
    ],
    defaultVariants: {
        variant: "default",
    },
});
