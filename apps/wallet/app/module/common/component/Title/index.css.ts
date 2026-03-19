import { style, styleVariants } from "@vanilla-extract/css";
import { brand, fontSize } from "@/tokens.css";

export const title = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[200],
    margin: 0,
});

export const size = styleVariants({
    medium: {
        fontSize: fontSize.s,
        fontWeight: brand.typography.fontWeight.medium,
    },
    big: {
        fontSize: fontSize.l,
        fontWeight: brand.typography.fontWeight.semiBold,
    },
});

export const align = styleVariants({
    left: {
        justifyContent: "flex-start",
    },
    center: {
        justifyContent: "center",
    },
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
