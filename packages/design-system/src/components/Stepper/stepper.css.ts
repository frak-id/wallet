import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

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
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    borderWidth: 1.5,
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
        borderStyle: "dashed",
        borderColor: vars.text.action,
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

export const checkIcon = style({
    width: 16,
    height: 16,
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

export const connectorDashed = style({
    position: "absolute",
    inset: 0,
    borderLeft: `1px dashed ${vars.text.action}`,
});
