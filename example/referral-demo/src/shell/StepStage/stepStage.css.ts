import { style } from "@vanilla-extract/css";

export const stage = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: "#000",
});

export const layer = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    willChange: "transform, opacity",
});
