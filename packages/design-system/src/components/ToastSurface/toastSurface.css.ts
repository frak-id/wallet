import { style, styleVariants } from "@vanilla-extract/css";

export const surface = style({
    position: "absolute",
    pointerEvents: "none",
});

export const placement = styleVariants({
    "top-center": {
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
    },
});
