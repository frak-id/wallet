import { keyframes } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { alias, brand } from "../../tokens.css";

const pulse = keyframes({
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.4 },
});

export const skeleton = recipe({
    base: {
        display: "inline-block",
        backgroundColor: brand.colors.neutral.grey300,
        animationName: pulse,
        animationDuration: "1.5s",
        animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
        animationIterationCount: "infinite",
        selectors: {
            "[data-theme='dark'] &": {
                backgroundColor: brand.colors.neutral.grey500,
            },
        },
    },
    variants: {
        variant: {
            text: {
                height: "16px",
                borderRadius: alias.cornerRadius.s,
                width: "100%",
            },
            circle: {
                borderRadius: alias.cornerRadius.full,
            },
            rect: {
                borderRadius: alias.cornerRadius.m,
                width: "100%",
            },
        },
    },
    defaultVariants: {
        variant: "text",
    },
});
