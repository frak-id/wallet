import { style } from "@vanilla-extract/css";

export const banner = style({
    position: "fixed",
    left: "12px",
    right: "12px",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
    zIndex: 9000,
    padding: "12px 14px",
    borderRadius: "12px",
    background: "rgba(15, 26, 46, 0.95)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
    color: "#ffffff",
});

export const progressTrack = style({
    width: "100%",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden",
});

export const progressBar = style({
    height: "100%",
    background: "#7aa6ff",
    transition: "width 200ms linear",
});
