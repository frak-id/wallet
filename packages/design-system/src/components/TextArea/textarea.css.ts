import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, transition } from "../../tokens.css";

// The error border does not change on focus, so the ring carries it.
const focusRing = { boxShadow: `0 0 0 2px ${vars.border.focus}` };

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
        // Fill with the error surface whenever the field is invalid —
        // FormControl sets aria-invalid, so this works without an explicit
        // `error` prop.
        '&:has(textarea[aria-invalid="true"])': {
            backgroundColor: vars.surface.error,
            borderColor: vars.border.error,
        },
        '&:has(textarea[aria-invalid="true"]:focus-visible)': focusRing,
    },
});

const wrapperError = style({
    borderColor: vars.border.error,
    selectors: {
        "&:focus-within": {
            borderColor: vars.border.error,
        },
        "&:has(:focus-visible)": focusRing,
    },
});

const wrapperDisabled = style({
    backgroundColor: vars.surface.disabled,
    cursor: "not-allowed",
    opacity: 0.6,
});

export const lengthVariants = recipe({
    variants: {
        length: {
            small: { width: "160px" },
            medium: { width: "320px" },
            big: { width: "100%" },
        },
    },
});

const fieldBase = style({
    width: "100%",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
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
        // Focus is shown on the wrapper: its border, or a ring in the error state.
        "&:focus": {
            outline: "none",
        },
    },
});

const fieldNoResize = style({
    resize: "none",
});

export const textareaStyles = {
    wrapper: wrapperBase,
    wrapperError,
    wrapperDisabled,
    field: fieldBase,
    fieldNoResize,
};
