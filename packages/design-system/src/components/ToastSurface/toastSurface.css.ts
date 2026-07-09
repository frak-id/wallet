import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const surface = style({
    position: "absolute",
    pointerEvents: "none",
});

export const placement = recipe({
    variants: {
        placement: {
            "top-center": {
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
            },
        },
    },
    defaultVariants: {
        placement: "top-center",
    },
});
