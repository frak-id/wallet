import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const page = style({
    paddingBottom: "112px",
});

export const kpiRow = style({
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: alias.spacing.m,
    "@media": {
        "screen and (max-width: 1080px)": {
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        },
        "screen and (max-width: 720px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
    },
});

export const twoColumns = style({
    display: "grid",
    // Funnel = 451 / Top campaigns = 685 (Figma "mid stats" frame).
    gridTemplateColumns: "minmax(0, 451fr) minmax(0, 685fr)",
    gap: alias.spacing.m,
    "@media": {
        "screen and (max-width: 960px)": {
            gridTemplateColumns: "minmax(0, 1fr)",
        },
    },
});

export const threeColumns = style({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: alias.spacing.m,
    "@media": {
        "screen and (max-width: 1080px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        "screen and (max-width: 720px)": {
            gridTemplateColumns: "minmax(0, 1fr)",
        },
    },
});

// Fixed chart height — the cards live in a stretched grid row, so an explicit
// height keeps the visx charts from filling the whole cell (aspect-ratio is
// only honoured when a dimension is auto).
export const chartBox = style({
    height: "180px",
});

export const chartAmount = style({
    fontSize: "32px",
    lineHeight: "36px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
    fontVariantNumeric: "tabular-nums",
});

export const chartAmountEmpty = style([
    chartAmount,
    { color: vars.text.disabled },
]);

// No-data placeholder that stands in for a chart's graphic. Mirrors `chartBox`'s
// height so swapping chart ↔ empty state doesn't change the card's footprint,
// and stretches to fill cards that lay their charts out with `flex: 1`.
export const chartEmpty = style({
    minHeight: "180px",
    flex: 1,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const chartEmptyIcon = style({
    color: vars.icon.disabled,
});
