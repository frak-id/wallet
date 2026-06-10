import { style, styleVariants } from "@vanilla-extract/css";
import { alias } from "../../tokens.css";

export const legendItem = styleVariants({
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
});

/** 8px rounded square; the colour comes from the call site. */
export const swatch = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});
