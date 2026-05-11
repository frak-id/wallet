import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

export const root = style({
    position: "relative",
    width: "100%",
});

export const indicator = style({
    position: "absolute",
    top: 0,
    left: "50%",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    backgroundColor: vars.surface.elevated,
    color: vars.icon.primary,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    pointerEvents: "none",
    opacity: 0,
    transform: "translate3d(-50%, -40px, 0)",
    willChange: "transform, opacity",
    zIndex: 1,
});

export const iconWrapper = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "center",
    willChange: "transform",
});

export const content = style({
    willChange: "transform",
});
