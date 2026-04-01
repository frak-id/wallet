import { globalStyle, style } from "@vanilla-extract/css";

/**
 * Global reset — applied to html, body, and universal selectors.
 */
globalStyle("*, *::after, *::before", {
    margin: 0,
    boxSizing: "border-box",
});

globalStyle("html", {
    height: "100vh",
    scrollBehavior: "smooth",
});

globalStyle("ul", {
    margin: 0,
    padding: 0,
    listStyle: "none",
});

globalStyle("sub, sup", {
    fontSize: "100%",
});

globalStyle("sup", {
    top: "-0.15em",
});

/**
 * Per-element CSS reset — scoped classes applied by Box.
 *
 * Resets are scoped vanilla-extract classes, not global stylesheets.
 * Box auto-applies `base` to every element and composes element-specific
 * resets from the `element` map.
 *
 * Import order matters: reset.css must be imported BEFORE sprinkles.css
 * so that sprinkles properties (e.g. padding) override reset defaults.
 */

// Base reset — applied to every Box element regardless of tag
export const base = style({
    margin: 0,
    padding: 0,
    border: 0,
    boxSizing: "border-box",
    fontSize: "100%",
    font: "inherit",
    verticalAlign: "baseline",
    WebkitTapHighlightColor: "transparent",
});

// --- Composable sub-resets ---

const focusRing = style({
    outline: "2px solid transparent",
    outlineOffset: "2px",
    selectors: {
        "&:focus-visible": {
            outlineColor: "currentColor",
        },
    },
});

const fieldAppearance = style({
    appearance: "none",
    backgroundColor: "transparent",
});

/**
 * Visually hidden — accessible to screen readers only.
 * VE equivalent of the `.sr-only` utility class.
 */
export const visuallyHidden = style({
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
});

// --- Element-specific resets, keyed by HTML tag ---

export const element = {
    // Lists
    ul: style({ listStyle: "none" }),
    ol: style({ listStyle: "none" }),

    // Interactive
    button: style([fieldAppearance, focusRing, { cursor: "pointer" }]),
    a: style([focusRing, { textDecoration: "none", color: "inherit" }]),

    // Form fields
    input: style([fieldAppearance, focusRing]),
    select: style([fieldAppearance, focusRing]),
    textarea: style([fieldAppearance, focusRing]),

    // Table
    table: style({ borderCollapse: "collapse", borderSpacing: 0 }),

    // Media
    img: style({ display: "block", maxWidth: "100%" }),
};
