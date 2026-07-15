import { globalStyle, style } from "@vanilla-extract/css";

/**
 * Grid layout driven by three CSS custom properties set per-element via inline
 * style. Mobile-first cascade: tablet defaults to mobile, desktop to tablet.
 */
export const tilesGrid = style({
    gridTemplateColumns: "repeat(var(--tiles-cols-mobile), minmax(0, 1fr))",
    "@media": {
        "screen and (min-width: 768px)": {
            gridTemplateColumns:
                "repeat(var(--tiles-cols-tablet), minmax(0, 1fr))",
        },
        "screen and (min-width: 1024px)": {
            gridTemplateColumns:
                "repeat(var(--tiles-cols-desktop), minmax(0, 1fr))",
        },
    },
});

/** Prevent grid children from blowing out the column track. */
globalStyle(`${tilesGrid} > *`, {
    minWidth: 0,
});
