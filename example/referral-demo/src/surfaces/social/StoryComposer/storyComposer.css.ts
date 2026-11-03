import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts } from "@/shell/device.css";

export const root = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    paddingTop: deviceInset.top,
    paddingBottom: deviceInset.bottom,
    background: "#000",
    color: "#fff",
    fontFamily: fonts.system,
    WebkitFontSmoothing: "antialiased",
});

export const stage = style({
    position: "relative",
    flex: 1,
    minHeight: 0,
});

export const canvasMotion = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    borderRadius: 10,
    transformOrigin: "16% 108%",
});

export const tools = style({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 8px 40px",
    background:
        "linear-gradient(to bottom, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0))",
});

export const toolGroup = style({
    display: "flex",
    gap: 2,
});

export const tool = style({
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    color: "#fff",
    filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))",
});

export const toast = style({
    position: "absolute",
    left: "50%",
    bottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px 8px 8px",
    borderRadius: 999,
    background: "#262626",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    translate: "-50% 0",
});

export const toastAvatar = style({
    display: "block",
    width: 28,
    height: 28,
});

export const bottomBar = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 12px 8px",
});

const pillPulse = keyframes({
    "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 255, 255, 0.45)" },
    "60%": { boxShadow: "0 0 0 8px rgba(255, 255, 255, 0)" },
});

export const pill = recipe({
    base: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 44,
        padding: "0 16px 0 10px",
        border: "none",
        borderRadius: 999,
        background: "#262626",
        color: "#fff",
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        WebkitTapHighlightColor: "transparent",
        transition: "transform 120ms ease",
        selectors: {
            "&:active": { transform: "scale(0.96)" },
        },
    },
    variants: {
        hint: {
            true: {
                cursor: "pointer",
                animation: `${pillPulse} 1.6s ease-out infinite`,
            },
            false: {},
        },
    },
});

export const pillAvatar = style({
    position: "relative",
    display: "block",
    width: 24,
    height: 24,
});

export const uploadRing = style({
    position: "absolute",
    inset: -5,
    width: 34,
    height: 34,
    transform: "rotate(-90deg)",
});

export const uploadTrack = style({
    fill: "none",
    stroke: "rgba(255, 255, 255, 0.2)",
    strokeWidth: 2,
});

export const uploadProgress = style({
    fill: "none",
    stroke: "#fff",
    strokeWidth: 2,
    strokeLinecap: "round",
});

export const closeFriendsBadge = style({
    width: 24,
    height: 24,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#1bd741",
    color: "#fff",
});

export const sendButton = style({
    flexShrink: 0,
    marginLeft: "auto",
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#fff",
    color: "#000",
});
