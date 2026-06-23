import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, brand } from "../../tokens.css";

/* ----- keyframes ----- */

const checkPopIn = keyframes({
    "0%": { opacity: 0, transform: "scale(0.4)" },
    "100%": { opacity: 1, transform: "scale(1)" },
});

const connectorSweep = keyframes({
    "0%": { transform: "scaleY(0)" },
    "100%": { transform: "scaleY(1)" },
});

/* ----- root ----- */

export const root = style({
    display: "flex",
    flexDirection: "column",
    gap: 5,
    alignItems: "flex-start",
    width: "100%",
    margin: 0,
    padding: 0,
    listStyle: "none",
});

/* ----- step row ----- */

export const item = style({
    width: "100%",
});

export const step = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
    width: "100%",
    position: "relative",
    padding: 0,
    border: "none",
    background: "none",
    textAlign: "left",
    font: "inherit",
});

export const stepInteractive = style({
    cursor: "pointer",
});

/* ----- indicator column (indicator + connector) ----- */

export const indicatorColumn = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
    width: 32,
});

/* ----- indicator circle ----- */

const indicatorBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: 32,
    height: 32,
    borderRadius: "50%",
    flexShrink: 0,
    fontSize: "14px",
    lineHeight: 1,
    fontWeight: brand.typography.fontWeight.medium,
    fontVariantNumeric: "tabular-nums",
    borderWidth: 1,
    borderStyle: "solid",
    transition:
        "color 200ms ease, border-color 200ms ease, background-color 200ms ease",
} as const;

export const indicator = styleVariants({
    default: {
        ...indicatorBase,
        borderColor: vars.border.default,
        color: vars.text.tertiary,
        backgroundColor: "transparent",
    },
    active: {
        ...indicatorBase,
        position: "relative",
        borderColor: "transparent",
        color: vars.text.action,
        backgroundColor: "transparent",
    },
    completed: {
        ...indicatorBase,
        borderColor: vars.text.action,
        color: vars.text.onAction,
        backgroundColor: vars.text.action,
    },
});

/**
 * The active ring, drawn as a real SVG: CSS `border-style: dashed` can't
 * reproduce the 2-2 round-capped dash pattern. The source glyph is a 33×33
 * box whose r=16 circle overflows the 32px indicator by 0.5px per side.
 */
export const activeRing = style({
    position: "absolute",
    inset: "-0.5px",
    width: "calc(100% + 1px)",
    height: "calc(100% + 1px)",
    pointerEvents: "none",
    stroke: vars.text.action,
});

export const checkIcon = style({
    width: 16,
    height: 16,
});

/** Pop-in, applied only to the step the user has just completed. */
export const checkIconPop = style({
    animation: `${checkPopIn} 250ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
        },
    },
});

/* ----- connector line ----- */

export const connectorWrap = style({
    position: "relative",
    width: 1,
    height: 32,
});

export const connectorBase = style({
    position: "absolute",
    inset: 0,
    backgroundColor: vars.border.default,
});

export const connectorFill = style({
    position: "absolute",
    inset: 0,
    backgroundColor: vars.text.action,
    transformOrigin: "top",
});

/** Top-down sweep, applied only to the connector the user has just crossed. */
export const connectorFillSweep = style({
    animation: `${connectorSweep} 300ms ease`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: "none",
        },
    },
});

/* ----- cell text ----- */

export const cell = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    minWidth: 0,
});

export const cellText = style({
    transition: "color 200ms ease",
});

/** 2px-on / 2px-off dashes; CSS `dashed` renders a different rhythm. */
export const connectorDashed = style({
    position: "absolute",
    inset: 0,
    backgroundImage: `repeating-linear-gradient(to bottom, ${vars.text.action} 0 2px, transparent 2px 4px)`,
});
