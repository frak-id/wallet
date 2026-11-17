import { createVar, fallbackVar, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

/** Callers move the toast down by setting this, never `top`: the recipe's `top` wins on stylesheet order. */
export const toastSurfaceTop = createVar();

export const surface = style({
    position: "absolute",
    pointerEvents: "none",
    // At left: 50% shrink-to-fit only gets half the parent: size to the content, wrap at the parent's width
    width: "max-content",
    maxWidth: "100%",
});

export const placement = recipe({
    variants: {
        placement: {
            "top-center": {
                top: fallbackVar(toastSurfaceTop, "0px"),
                left: "50%",
                transform: "translateX(-50%)",
            },
        },
    },
    defaultVariants: {
        placement: "top-center",
    },
});
