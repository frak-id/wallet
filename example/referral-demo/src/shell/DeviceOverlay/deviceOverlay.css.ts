import { globalStyle, style } from "@vanilla-extract/css";

export const host = style({
    position: "absolute",
    inset: 0,
    zIndex: 30,
    pointerEvents: "none",
});

// Portaled content is caller-supplied: only it may catch taps, never the empty host.
globalStyle(`${host} > *`, {
    pointerEvents: "auto",
});
