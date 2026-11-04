import { keyframes, style } from "@vanilla-extract/css";
import { deviceInset, fonts } from "@/shell/device.css";

const glass = {
    light: "rgba(250, 250, 250, 0.66)",
    dark: "rgba(18, 18, 30, 0.32)",
};

export const screen = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: "#000",
    color: "#fff",
    fontFamily: fonts.system,
    WebkitUserSelect: "none",
    userSelect: "none",
});

/** Dusk over water: soft light pools, darker at the top so the clock reads. */
export const wallpaper = style({
    position: "absolute",
    inset: 0,
    background: [
        "radial-gradient(120% 60% at 50% 0%, rgba(8, 10, 34, 0.75) 0%, rgba(8, 10, 34, 0) 70%)",
        "radial-gradient(70% 45% at 18% 58%, rgba(124, 92, 230, 0.9) 0%, rgba(124, 92, 230, 0) 70%)",
        "radial-gradient(65% 40% at 88% 72%, rgba(236, 110, 150, 0.85) 0%, rgba(236, 110, 150, 0) 70%)",
        "radial-gradient(80% 38% at 40% 104%, rgba(255, 176, 102, 0.95) 0%, rgba(255, 176, 102, 0) 72%)",
        "radial-gradient(60% 35% at 92% 22%, rgba(52, 150, 190, 0.7) 0%, rgba(52, 150, 190, 0) 70%)",
        "linear-gradient(180deg, #0c1238 0%, #26205e 45%, #4a2a6e 75%, #6e3a5e 100%)",
    ].join(", "),
});

export const ripples = style({
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "52%",
    opacity: 0.55,
});

export const top = style({
    position: "absolute",
    left: 0,
    right: 0,
    top: `calc(${deviceInset.top} + 2px)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textShadow: "0 1px 12px rgba(0, 0, 0, 0.12)",
});

export const lock = style({
    display: "block",
    marginBottom: 10,
    opacity: 0.95,
});

export const date = style({
    fontSize: 21,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: "rgba(255, 255, 255, 0.86)",
});

export const clock = style({
    marginTop: -4,
    fontSize: 104,
    lineHeight: 1,
    fontWeight: 600,
    letterSpacing: "-0.035em",
    color: "rgba(255, 255, 255, 0.94)",
});

export const notifications = style({
    position: "absolute",
    left: 10,
    right: 10,
    bottom: `calc(${deviceInset.bottom} + 92px)`,
});

export const notification = style({
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    padding: "13px 15px 14px 13px",
    border: 0,
    borderRadius: 24,
    background: glass.light,
    backdropFilter: "saturate(180%) blur(28px)",
    WebkitBackdropFilter: "saturate(180%) blur(28px)",
    color: "#000",
    fontFamily: fonts.system,
    textAlign: "left",
    cursor: "pointer",
    selectors: { "&:disabled": { cursor: "default" } },
    WebkitTapHighlightColor: "transparent",
});

export const appIcon = style({
    flexShrink: 0,
    width: 38,
    height: 38,
    marginTop: 1,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: 9,
    boxShadow: "0 0 0 0.5px rgba(0, 0, 0, 0.08)",
});

export const notificationText = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
});

export const notificationHeader = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
});

export const notificationTitle = style({
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
});

export const notificationTime = style({
    flexShrink: 0,
    fontSize: 13,
    color: "rgba(60, 60, 67, 0.62)",
});

export const notificationSubject = style({
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
});

export const notificationBody = style({
    fontSize: 15,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
});

export const quickActions = style({
    position: "absolute",
    left: 46,
    right: 46,
    bottom: `calc(${deviceInset.bottom} + 14px)`,
    display: "flex",
    justifyContent: "space-between",
});

export const quickAction = style({
    width: 50,
    height: 50,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: glass.dark,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    color: "#fff",
});

export const timeSkip = style({
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "grid",
    placeItems: "center",
    background: "#000",
    pointerEvents: "none",
});

const riseIn = keyframes({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "none" },
});

export const timeSkipText = style({
    animation: `${riseIn} 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.2s both`,
    fontSize: 30,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#fff",
});
