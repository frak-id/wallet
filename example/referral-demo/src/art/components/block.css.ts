import { style } from "@vanilla-extract/css";

/** Sizes stay on the SVG `width`/`height` attributes so any caller class wins. */
export const block = style({
    display: "block",
    flexShrink: 0,
});
