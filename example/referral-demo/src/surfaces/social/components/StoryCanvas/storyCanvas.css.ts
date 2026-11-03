import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { fonts } from "@/shell/device.css";

export const canvas = style({
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: 10,
    background: "#1a1a1a",
    fontFamily: fonts.system,
    color: "#fff",
});

export const scene = style({
    position: "absolute",
    inset: 0,
});

export const headline = style({
    position: "absolute",
    top: "17%",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    transform: "rotate(-4deg)",
    pointerEvents: "none",
});

export const headlineLabel = style({
    padding: "6px 12px 7px",
    borderRadius: 8,
    background: "#fff",
    color: "#000",
    fontSize: 25,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.12)",
});

export const stickerAnchor = style({
    position: "absolute",
    top: "80%",
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
});

export const stickerWrap = style({
    position: "relative",
});

export const bubbleSlot = style({
    position: "absolute",
    left: "50%",
    bottom: "calc(100% + 14px)",
    translate: "-50% 0",
    whiteSpace: "nowrap",
});

const stickerPulse = keyframes({
    "0%, 100%": {
        transform: "rotate(-2deg) scale(1)",
        boxShadow:
            "0 4px 14px rgba(0, 0, 0, 0.18), 0 0 0 0 rgba(255, 255, 255, 0.6)",
    },
    "50%": {
        transform: "rotate(-2deg) scale(1.06)",
        boxShadow:
            "0 6px 18px rgba(0, 0, 0, 0.22), 0 0 0 8px rgba(255, 255, 255, 0)",
    },
});

export const sticker = recipe({
    base: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px 9px 11px",
        border: "none",
        borderRadius: 9,
        background: "#fff",
        color: "#2a7cf6",
        font: "inherit",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
        transform: "rotate(-2deg)",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
    },
    variants: {
        pulse: {
            true: { animation: `${stickerPulse} 1.8s ease-in-out infinite` },
            false: {},
        },
    },
});

export const caption = style({
    padding: "4px 10px",
    borderRadius: 6,
    background: "rgba(0, 0, 0, 0.55)",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    pointerEvents: "none",
});
