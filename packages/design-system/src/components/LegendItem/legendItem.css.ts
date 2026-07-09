import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { alias } from "../../tokens.css";

export const legendItem = recipe({
    variants: {
        layout: {
            // Swatch and label on one line (status bars, breakdown legends).
            inline: {
                display: "inline-flex",
                alignItems: "center",
                gap: alias.spacing.xxs,
            },
            // Swatch above the label, both flush left (chart-card legends).
            stacked: {
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: alias.spacing.xxs,
            },
        },
    },
    defaultVariants: {
        layout: "inline",
    },
});

/** 8px rounded square; the colour comes from the call site. */
export const swatch = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});
