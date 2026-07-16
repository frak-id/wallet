import { brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const title = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        gap: brand.scale[200],
        margin: 0,
    },
    variants: {
        size: {
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
        },
        align: {
            left: {
                justifyContent: "flex-start",
            },
            center: {
                justifyContent: "center",
            },
        },
    },
    defaultVariants: {
        size: "medium",
        align: "left",
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
