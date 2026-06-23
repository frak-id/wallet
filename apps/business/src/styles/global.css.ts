import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle } from "@vanilla-extract/css";

globalStyle("*, *::after, *::before", {
    margin: 0,
    boxSizing: "border-box",
});

globalStyle("html", {
    fontFamily: `"Inter", ${brand.typography.fontFamily.inter}`,
    fontStyle: "normal",
    fontWeight: brand.typography.fontWeight.medium,
    fontSize: "16px",
    scrollBehavior: "smooth",
    overflowX: "hidden",
    // Always reserve the scrollbar gutter so opening a Radix overlay (Select,
    // Dialog…) — which locks body scroll — doesn't shift the page sideways.
    scrollbarGutter: "stable",
});

globalStyle("body", {
    fontSize: "14px",
    lineHeight: 1.5,
    WebkitFontSmoothing: "antialiased",
    // No `overflow-x` here: <html> already clips horizontal scroll and is the
    // scroll container. Setting it on <body> too makes <body> its own
    // non-scrolling scroll-box, which breaks `position: sticky` descendants.
    margin: 0,
    padding: 0,
});

// Radix overlays (Select/Dialog…) lock scroll via react-remove-scroll, which
// adds an inline `padding-right` to the body to offset the scrollbar. Our
// scroll container is <html> (overflow-x: hidden), not <body>, so that padding
// has nothing to compensate and just shifts the page sideways. Cancel it.
// `html body…` (specificity 0,1,2) outranks RRS's own `body[data-scroll-locked]`
// `!important` rule (0,1,1), which is injected at runtime and would otherwise
// win the source-order tie.
globalStyle("html body[data-scroll-locked]", {
    paddingRight: "0 !important",
    marginRight: "0 !important",
});

globalStyle("ul", {
    margin: 0,
    padding: 0,
    listStyle: "none",
});

globalStyle("a", {
    color: vars.text.primary,
    textDecoration: "none",
});
