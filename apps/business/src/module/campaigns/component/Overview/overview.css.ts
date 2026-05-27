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
    gap: alias.spacing.s,
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
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
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

export const card = style({
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.l,
    padding: alias.spacing.l,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const cardHeader = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});

export const cardTitleRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
});

export const cardSubtitle = style({
    fontSize: "13px",
    color: vars.text.secondary,
});

export const funnelChartWrap = style({
    marginTop: alias.spacing.m,
});

export const revenueLegend = style({
    display: "flex",
    gap: alias.spacing.m,
});

export const legendRow = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    fontSize: "13px",
    color: vars.text.secondary,
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
    {
        backgroundColor: "transparent",
        border: `1.5px dashed ${vars.icon.success}`,
    },
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
