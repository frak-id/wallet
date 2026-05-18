import { alias, brand } from "@frak-labs/design-system/tokens";
import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const inputWrapper = recipe({
    base: {
        marginLeft: "1px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        border: `1px solid ${brand.colors.neutral.grey250}`,
        borderRadius: alias.cornerRadius.xs,
        overflow: "hidden",
        backgroundColor: vars.surface.elevated,
        color: vars.text.primary,
        transition: "border-color 0.2s",
    },
    variants: {
        length: {
            small: { width: "157px" },
            medium: { width: "320px" },
            big: { width: "100%" },
        },
    },
});

export const input = style({
    all: "unset",
    boxSizing: "border-box",
    padding: "9px 12px",
    width: "100%",
    lineHeight: "20px",
    fontSize: "16px",
    color: vars.text.primary,
    fontWeight: 400,
    selectors: {
        "&::placeholder": {
            color: vars.text.tertiary,
            opacity: 1,
        },
        "&::-ms-input-placeholder": {
            color: vars.text.tertiary,
        },
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.6,
        },
        '&[data-invalid="true"]': {
            borderColor: "#818c9c",
            color: "#adadad",
        },
    },
});

// Hide spinner buttons for number inputs
globalStyle(
    `${input}::-webkit-outer-spin-button, ${input}::-webkit-inner-spin-button`,
    {
        WebkitAppearance: "none",
        margin: 0,
    }
);

globalStyle(`${input}[type="number"]`, {
    MozAppearance: "textfield",
});

// Focus outline on wrapper when input has focus
globalStyle(`*:has(> ${input}:focus)`, {
    boxShadow: `0 0 0 1px ${brand.colors.primary[500]}`,
});

export const rightSection = style({
    paddingRight: "12px",
    fontWeight: 400,
    color: vars.text.secondary,
    textTransform: "uppercase",
});
