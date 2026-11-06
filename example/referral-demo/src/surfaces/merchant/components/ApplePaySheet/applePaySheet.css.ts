import { keyframes, style } from "@vanilla-extract/css";
import { deviceInset, fonts, iosColors } from "@/shell/device.css";

const ios = {
    label: "#8a8a8e",
    separator: iosColors.separator,
    fill: "#e9e9eb",
    blue: iosColors.blue,
    text: iosColors.label,
};

export const backdrop = style({
    position: "absolute",
    inset: 0,
    zIndex: 10,
    background: "rgba(0, 0, 0, 0.4)",
});

export const sheet = style({
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 11,
    display: "flex",
    flexDirection: "column",
    paddingBottom: `calc(${deviceInset.bottom} + 18px)`,
    background: "#fff",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    color: ios.text,
    fontFamily: fonts.system,
    WebkitFontSmoothing: "antialiased",
    boxShadow: "0 -6px 30px rgba(0, 0, 0, 0.12)",
});

export const head = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 16px 10px",
    fontSize: 22,
});

export const close = style({
    display: "grid",
    placeItems: "center",
    width: 30,
    height: 30,
    padding: 0,
    border: 0,
    borderRadius: "50%",
    background: ios.fill,
    color: "#3c3c43",
});

export const row = style({
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    margin: "0 0 0 16px",
    padding: "10px 16px 10px 0",
    borderTop: `0.5px solid ${ios.separator}`,
    fontSize: 15,
    lineHeight: 1.3,
});

export const label = style({
    flexShrink: 0,
    width: 78,
    alignSelf: "flex-start",
    paddingTop: 1,
    fontSize: 13,
    color: ios.label,
});

export const value = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
});

export const secondary = style({ color: ios.label, fontSize: 13 });

export const chevron = style({ flexShrink: 0, color: "#c4c4c7" });

export const cardArt = style({ flexShrink: 0, display: "block" });

export const cardName = style({ fontWeight: 600 });

export const total = style({
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    margin: "0 16px",
    padding: "16px 0 12px",
    borderTop: `0.5px solid ${ios.separator}`,
});

export const payTo = style({ fontSize: 15, color: ios.label });

export const amount = style({
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: "-0.01em",
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 92,
    fontSize: 15,
});

export const faceId = style({ color: ios.text });

export const done = style({ color: ios.blue, fontWeight: 500 });

const nudge = keyframes({
    "0%, 100%": { transform: "translateX(0)" },
    "50%": { transform: "translateX(-6px)" },
});

export const doubleClick = style({
    position: "absolute",
    top: 186,
    right: 0,
    zIndex: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    pointerEvents: "none",
});

export const doubleClickText = style({
    color: "#fff",
    whiteSpace: "pre-line",
    fontFamily: fonts.system,
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: "right",
    textShadow: "0 1px 6px rgba(0, 0, 0, 0.35)",
});

export const sideButton = style({
    width: 7,
    height: 84,
    marginRight: -2,
    borderRadius: 4,
    background: "#fff",
    boxShadow: "0 0 14px rgba(255, 255, 255, 0.7)",
    animation: `${nudge} 1.1s ease-in-out infinite`,
});
