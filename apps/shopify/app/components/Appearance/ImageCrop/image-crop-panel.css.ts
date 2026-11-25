import { style } from "@vanilla-extract/css";

// react-easy-crop fills its nearest positioned ancestor.
export const cropArea = style({
    position: "relative",
    height: 320,
});

export const zoomSlider = style({
    width: "100%",
    margin: 0,
});
