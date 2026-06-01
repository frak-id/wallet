import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, easing, transition } from "../../tokens.css";

/**
 * The box is drawn from the Figma squircle glyphs (SVG), not CSS
 * border-radius, so the continuous-corner shape matches the design exactly.
 */
export const root = style({
    all: "unset",
    position: "relative",
    display: "inline-block",
    width: "20px",
    height: "20px",
    cursor: "pointer",
    boxSizing: "border-box",
    transition: `opacity ${transition.base} ${easing.default}`,

    ":focus-visible": {
        boxShadow: `0 0 0 2px ${vars.border.focus}`,
        borderRadius: alias.cornerRadius.s,
    },

    selectors: {
        "&[data-disabled]": {
            opacity: 0.5,
            cursor: "not-allowed",
        },
    },
});

/** Off state: the 2px grey squircle ring (always rendered, behind the fill). */
export const box = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    fill: vars.border.default,
});

/** Checked / indeterminate overlay (mounted by radix). */
export const indicator = style({
    position: "absolute",
    inset: 0,
    display: "block",
    width: "100%",
    height: "100%",
});

export const squareFill = style({ fill: vars.surface.primary });
export const glyph = style({ fill: vars.text.onAction });
