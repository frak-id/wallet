import { safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import {
    DEVICE_BEZEL,
    DEVICE_HEIGHT,
    DEVICE_WIDTH,
    deviceInset,
} from "../device.css";

export const fit = style({
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const sizer = style({
    position: "relative",
    flexShrink: 0,
});

export const phone = style({
    position: "absolute",
    top: 0,
    left: 0,
    transformOrigin: "top left",
    width: DEVICE_WIDTH + DEVICE_BEZEL * 2,
    height: DEVICE_HEIGHT + DEVICE_BEZEL * 2,
    padding: DEVICE_BEZEL,
    borderRadius: 70,
    background:
        "linear-gradient(145deg, #3a3a3c 0%, #1c1c1e 40%, #2c2c2e 100%)",
    boxShadow: [
        "0 0 0 1.5px #545456 inset",
        "0 0 0 4px #0b0b0c inset",
        "0 40px 80px -20px rgba(0, 0, 0, 0.55)",
        "0 20px 40px -20px rgba(0, 0, 0, 0.4)",
    ].join(", "),
});

export const frameScreen = style({
    position: "relative",
    width: DEVICE_WIDTH,
    height: DEVICE_HEIGHT,
    overflow: "hidden",
    borderRadius: 58,
    background: "#000",
    isolation: "isolate",
    vars: {
        [deviceInset.top]: "54px",
        [deviceInset.bottom]: "34px",
    },
});

export const island = style({
    position: "absolute",
    top: 11,
    left: "50%",
    width: 124,
    height: 36,
    marginLeft: -62,
    borderRadius: 20,
    background: "#000",
    zIndex: 60,
    pointerEvents: "none",
});

export const homeIndicator = recipe({
    base: {
        position: "absolute",
        bottom: 8,
        left: "50%",
        width: 140,
        height: 5,
        marginLeft: -70,
        borderRadius: 3,
        zIndex: 60,
        pointerEvents: "none",
        transition: "background 240ms ease",
    },
    variants: {
        tone: {
            dark: { background: "rgba(0, 0, 0, 0.85)" },
            light: { background: "rgba(255, 255, 255, 0.9)" },
        },
    },
});

export const fullScreen = style({
    position: "fixed",
    inset: 0,
    overflow: "hidden",
    background: "#000",
    isolation: "isolate",
    vars: {
        [deviceInset.top]: safeArea.top,
        [deviceInset.bottom]: safeArea.bottom,
    },
});
