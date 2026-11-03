import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { merchant } from "@/data/merchant";
import { fonts } from "@/shell/device.css";

export const palette = merchant.palette;

/** Fills the browser viewport; content scrolls inside `scroll`. */
export const screen = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: palette.paper,
    color: palette.ink,
    fontFamily: fonts.system,
    fontSize: 14,
    lineHeight: 1.45,
    WebkitFontSmoothing: "antialiased",
});

export const scroll = style({
    position: "relative",
    flex: 1,
    minHeight: 0,
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarWidth: "none",
    selectors: { "&::-webkit-scrollbar": { display: "none" } },
});

export const bottomBar = style({
    position: "relative",
    zIndex: 2,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "12px 16px 14px",
    background: palette.paper,
    borderTop: `1px solid ${palette.line}`,
});

export const eyebrow = style({
    margin: 0,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: palette.muted,
});

export const muted = style({ color: palette.muted });

export const pressable = style({
    WebkitTapHighlightColor: "transparent",
    cursor: "pointer",
    transition: "transform 120ms ease, opacity 120ms ease",
    selectors: {
        "&:active": { transform: "scale(0.98)", opacity: 0.85 },
    },
});

export const iconButton = style([
    pressable,
    {
        display: "grid",
        placeItems: "center",
        width: 40,
        height: 40,
        padding: 0,
        border: 0,
        background: "transparent",
        color: "inherit",
    },
]);

export const storeButton = recipe({
    base: [
        pressable,
        {
            appearance: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            height: 52,
            padding: "0 18px",
            borderRadius: 2,
            fontFamily: fonts.system,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
        },
    ],
    variants: {
        tone: {
            ink: {
                border: `1px solid ${palette.ink}`,
                background: palette.ink,
                color: palette.paper,
            },
            outline: {
                border: `1px solid ${palette.ink}`,
                background: "transparent",
                color: palette.ink,
            },
        },
    },
    defaultVariants: { tone: "ink" },
});

export const linkButton = style([
    pressable,
    {
        appearance: "none",
        padding: 0,
        border: 0,
        background: "transparent",
        color: palette.ink,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textDecoration: "underline",
        textUnderlineOffset: 4,
    },
]);

const spin = keyframes({ to: { transform: "rotate(360deg)" } });

export const spinner = style({
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "2px solid currentColor",
    borderRightColor: "transparent",
    animation: `${spin} 700ms linear infinite`,
});

const hintPulse = keyframes({
    "0%": { boxShadow: `0 0 0 0 rgba(31, 27, 22, 0.22)` },
    "70%": { boxShadow: `0 0 0 10px rgba(31, 27, 22, 0)` },
    "100%": { boxShadow: `0 0 0 0 rgba(31, 27, 22, 0)` },
});

/** Draws the presenter's eye to the primary action once the screen has settled. */
export const hint = style({
    animation: `${hintPulse} 1.8s ease-out 1.5s infinite`,
});
