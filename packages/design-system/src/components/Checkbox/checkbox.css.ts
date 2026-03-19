import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias, easing, transition } from "@/tokens.css";

export const checkboxRoot = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: alias.cornerRadius.s,
    border: `1px solid ${vars.border.default}`,
    backgroundColor: vars.surface.background,
    cursor: "pointer",
    transition: `all ${transition.base} ${easing.default}`,

    ":focus-visible": {
        boxShadow: `0 0 0 2px ${vars.border.focus}`,
    },

    selectors: {
        '&[data-state="checked"]': {
            backgroundColor: vars.surface.primary,
            borderColor: vars.surface.primary,
        },
        '&[data-state="indeterminate"]': {
            backgroundColor: vars.surface.primary,
            borderColor: vars.surface.primary,
        },
        "&[data-disabled]": {
            opacity: 0.5,
            cursor: "not-allowed",
        },
    },
});

export const checkboxIndicator = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.text.onAction,
});
