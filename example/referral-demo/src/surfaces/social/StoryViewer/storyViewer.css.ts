import { keyframes, style } from "@vanilla-extract/css";
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

export const top = style({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: "8px 8px 36px",
    background:
        "linear-gradient(to bottom, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0))",
    pointerEvents: "none",
});

export const progress = style({
    display: "flex",
    gap: 3,
});

export const segment = style({
    position: "relative",
    flex: 1,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.35)",
});

const segmentProgress = keyframes({
    from: { transform: "scaleX(0)" },
    to: { transform: "scaleX(1)" },
});

/** Runs once and holds: the viewer never auto-advances, the presenter does. */
export const segmentFill = style({
    position: "absolute",
    inset: 0,
    background: "#fff",
    transformOrigin: "0 50%",
    animation: `${segmentProgress} 5s linear forwards`,
});

export const header = style({
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingLeft: 4,
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.25)",
});

export const handle = style({
    fontSize: 14,
    fontWeight: 600,
});

export const age = style({
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.75)",
});

export const spacer = style({
    flex: 1,
});

export const bubble = style({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    border: "none",
    borderRadius: 12,
    background: "#fff",
    color: "#000",
    font: "inherit",
    fontSize: 15,
    fontWeight: 600,
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
});

export const bubbleCaret = style({
    position: "absolute",
    left: "50%",
    bottom: -6,
    width: 12,
    height: 12,
    marginLeft: -6,
    background: "#fff",
    transform: "rotate(45deg)",
    borderRadius: 2,
});

export const bottomBar = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 18,
    padding: "10px 16px 6px 12px",
});

export const messageField = style({
    flex: 1,
    height: 44,
    display: "flex",
    alignItems: "center",
    paddingInline: 18,
    borderRadius: 22,
    border: "1px solid rgba(255, 255, 255, 0.55)",
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
});
