import { brand, fontSize } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const title = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[200],
    margin: 0,
});

export const size = styleVariants({
    page: {
        fontSize: fontSize["3xl"],
        fontWeight: brand.typography.fontWeight.bold,
        lineHeight: "38px",
    },
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
