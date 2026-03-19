import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias, transition } from "@/tokens.css";

const wrapperBase = style({
    display: "flex",
    alignItems: "flex-start",
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
});

const wrapperError = style({
    borderColor: vars.border.error,
    selectors: {
        "&:focus-within": {
            borderColor: vars.border.error,
        },
    },
});

const wrapperDisabled = style({
    backgroundColor: vars.surface.disabled,
    cursor: "not-allowed",
    opacity: 0.6,
});

export const lengthVariants = styleVariants({
    small: { width: "160px" },
    medium: { width: "320px" },
    big: { width: "100%" },
});

const fieldBase = style({
    width: "100%",
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    fontSize: "16px",
    lineHeight: "20px",
    fontWeight: String(400),
    color: vars.text.primary,
    resize: "vertical",
    minHeight: "80px",
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

export const textareaStyles = {
    wrapper: wrapperBase,
    wrapperError,
    wrapperDisabled,
    field: fieldBase,
};
