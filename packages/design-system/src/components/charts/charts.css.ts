import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { fontSize } from "../../tokens.css";

const centered = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
} as const;

const textXs = { fontSize: fontSize.xs, lineHeight: "1rem" } as const;
const textSm = { fontSize: fontSize.s, lineHeight: "1.25rem" } as const;
const shadowLg =
    "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)";

export const chartRoot = style({ position: "relative", width: "100%" });

export const pieRoot = style({ position: "relative", ...centered });

export const pieStack = style({ display: "grid" });

export const overlay = style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
});

export const floating = style({
    position: "absolute",
    pointerEvents: "none",
    zIndex: 50,
});

export const xTick = style({ position: "absolute" });

export const xTickLabel = style({
    ...textXs,
    whiteSpace: "nowrap",
    color: vars.text.tertiary,
});

export const yAxis = style({ position: "absolute", pointerEvents: "none" });

export const yTickLabel = style({
    ...textXs,
    position: "absolute",
    color: vars.text.tertiary,
});

export const tooltipBox = style({
    minWidth: "140px",
    overflow: "hidden",
    borderRadius: "0.5rem",
    backgroundColor: vars.text.primary,
    color: vars.surface.background,
    boxShadow: shadowLg,
    backdropFilter: "blur(12px)",
});

export const tooltipClip = style({ overflow: "hidden" });

export const tooltipBody = style({ padding: "0.625rem 0.75rem" });

export const tooltipTitle = style({
    ...textXs,
    marginBottom: "0.5rem",
    fontWeight: 500,
    color: vars.surface.background,
});

export const tooltipRow = style({
    ...centered,
    justifyContent: "space-between",
    gap: "1rem",
    selectors: { "& + &": { marginTop: "0.375rem" } },
});

export const tooltipKey = style({
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
});

export const tooltipSwatch = style({
    width: "0.625rem",
    height: "0.625rem",
    flexShrink: 0,
    borderRadius: "9999px",
});

export const tooltipLabel = style({ ...textSm, color: vars.icon.tertiary });

export const tooltipValue = style({
    ...textSm,
    fontWeight: 500,
    color: vars.surface.background,
    fontVariantNumeric: "tabular-nums",
});

export const datePill = style({
    overflow: "hidden",
    borderRadius: "9999px",
    padding: "0.25rem 1rem",
    backgroundColor: "#18181b",
    color: "#ffffff",
    boxShadow: shadowLg,
});

export const tickerWindow = style({
    position: "relative",
    height: "1.5rem",
    overflow: "hidden",
});

export const tickerStacks = style({ ...centered, gap: "0.25rem" });

export const tickerColumn = style({
    display: "flex",
    flexDirection: "column",
});

export const tickerItem = style({
    ...centered,
    height: "1.5rem",
    flexShrink: 0,
});

export const tickerText = style({
    ...textSm,
    whiteSpace: "nowrap",
    fontWeight: 500,
});
