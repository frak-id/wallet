import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, transition } from "../../tokens.css";

export const inputWrapper = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        borderRadius: alias.cornerRadius.s,
        border: `${alias.borderWidth.xs} solid ${vars.border.default}`,
        backgroundColor: vars.surface.background,
        color: vars.text.primary,
        transition: `border-color ${transition.base} ease`,
        overflow: "hidden",
        selectors: {
            "&:focus-within": {
                borderColor: vars.border.focus,
            },
        },
    },
    variants: {
        length: {
            small: { width: "160px" },
            medium: { width: "320px" },
            big: { width: "100%" },
        },
        error: {
            true: {
                borderColor: vars.border.error,
                selectors: {
                    "&:focus-within": {
                        borderColor: vars.border.error,
                    },
                },
            },
        },
        disabled: {
            true: {
                backgroundColor: vars.surface.disabled,
                cursor: "not-allowed",
                opacity: 0.6,
            },
        },
    },
});

const section = style({
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
});

export const inputField = style({
    width: "100%",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
    fontSize: "16px",
    lineHeight: "20px",
    fontWeight: String(400),
    color: vars.text.primary,
    "::placeholder": {
        color: vars.text.tertiary,
        opacity: 1,
    },
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
        },
    },
});

export const leftSection = style([section, { paddingLeft: alias.spacing.m }]);
export const rightSection = style([section, { paddingRight: alias.spacing.m }]);
