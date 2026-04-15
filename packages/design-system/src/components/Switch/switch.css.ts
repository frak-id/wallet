import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, easing, transition } from "../../tokens.css";

export const switchRoot = style({
    all: "unset",
    position: "relative",
    width: "46px",
    height: "26px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.icon.disabled,
    border: `1px solid ${vars.border.default}`,
    cursor: "pointer",
    WebkitTapHighlightColor: "rgba(0, 0, 0, 0)",
    transition: `all ${transition.base} ${easing.default}`,

    ":focus-visible": {
        boxShadow: `0 0 0 2px ${vars.border.focus}`,
    },

    selectors: {
        '&[data-state="checked"]': {
            backgroundColor: vars.surface.primary,
            borderColor: vars.surface.primary,
        },
        "&[data-disabled]": {
            opacity: 0.5,
            cursor: "not-allowed",
        },
    },
});

export const switchThumb = style({
    display: "block",
    width: "24px",
    height: "24px",
    backgroundColor: "white",
    borderRadius: alias.cornerRadius.full,
    transition: `transform ${transition.base} ${easing.default}`,
    transform: "translateX(1px)",
    willChange: "transform",

    selectors: {
        '&[data-state="checked"]': {
            transform: "translateX(21px)",
        },
    },
});
