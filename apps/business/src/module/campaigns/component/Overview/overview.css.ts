import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const SIDEBAR_WIDTH_DESKTOP = "240px";
const SIDEBAR_WIDTH_MOBILE = "64px";

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
    fontWeight: 600,
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

export const legendDot = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});

export const legendDotPrimary = style([
    legendDot,
    { backgroundColor: vars.icon.action },
]);

export const legendDotSuccess = style([
    legendDot,
    { backgroundColor: vars.icon.success },
]);

export const legendDotForecast = style([
    legendDot,
    { backgroundColor: vars.icon.tertiary },
]);

export const floatingFooter = style({
    position: "fixed",
    bottom: 0,
    left: SIDEBAR_WIDTH_DESKTOP,
    right: 0,
    height: "96px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 10,
    "@media": {
        "screen and (max-width: 768px)": {
            left: SIDEBAR_WIDTH_MOBILE,
        },
    },
});

export const floatingFooterEdge = style({
    position: "absolute",
    inset: 0,
    backgroundImage: `linear-gradient(to top, ${vars.surface.background2} 30%, rgba(249, 250, 251, 0))`,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    maskImage: "linear-gradient(to top, black 30%, transparent)",
    WebkitMaskImage: "linear-gradient(to top, black 30%, transparent)",
});

export const floatingFooterButtonWrap = style({
    position: "relative",
    pointerEvents: "auto",
});
