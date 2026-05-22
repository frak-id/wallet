import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, fontSize, transition } from "../../tokens.css";

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
             * Borderless 56px flat card. Pick the surface tone via the
             * `tone` axis: `elevated` (white card, for non-white page
             * backgrounds — Monerium recap, IBAN form) or `muted`
             * (#f7f7f7, for white page backgrounds — referral redeem).
             */
            bare: {
                borderRadius: alias.cornerRadius.m,
                height: "56px",
                paddingInline: alias.spacing.m,
                gap: alias.spacing.xs,
            },
            /**
             * Borderless soft search field — white surface, no focus
             * ring, compact padding. Designed for dashboard table
             * filters (campaigns, members) where the input sits
             * directly on a coloured page background.
             */
            soft: {
                borderRadius: "10px",
                backgroundColor: vars.surface.background,
                padding: "6px 8px",
                gap: alias.spacing.xs,
                color: vars.icon.tertiary,
            },
        },
        length: {
            small: { width: "160px" },
            medium: { width: "320px" },
            big: { width: "100%" },
        },
        tone: {
            elevated: {},
            muted: {},
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
            variants: { variant: "bare", tone: "elevated" },
            style: { backgroundColor: vars.surface.elevated },
        },
        {
            variants: { variant: "bare", tone: "muted" },
            style: { backgroundColor: vars.surface.muted },
        },
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
        tone: "elevated",
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
            soft: {
                flex: "1 1 auto",
                minWidth: 0,
                border: "none",
                outline: "none",
                padding: 0,
                margin: 0,
                fontSize: fontSize.s,
                lineHeight: "22px",
                fontWeight: 400,
                "::placeholder": {
                    color: vars.text.tertiary,
                    opacity: 1,
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
            // Default keeps the inset paddings; bare and soft wrappers already pad.
            default: {},
            bare: {},
            soft: {},
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
