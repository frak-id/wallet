import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const titleVariants = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    variants: {
        tag: {
            h2: { fontWeight: 500 },
            h3: { fontWeight: 500 },
        },
        size: {
            small: { fontSize: "16px" },
            medium: { fontSize: "24px" },
            big: { fontSize: "32px" },
        },
    },
    defaultVariants: {
        size: "small",
    },
});

export const titleIcon = style({
    display: "flex",
});

export const titleText = style({
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
    "@supports": {
        "(-webkit-line-clamp: 2)": {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "initial",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
        },
    },
});
