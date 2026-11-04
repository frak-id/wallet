import { style } from "@vanilla-extract/css";
import { deviceInset } from "@/shell/device.css";

export const toastSlot = style({
    position: "absolute",
    zIndex: 35,
    top: `calc(${deviceInset.top} + 8px)`,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
});

export const burst = style({
    position: "absolute",
    zIndex: 25,
    top: `calc(${deviceInset.top} + 150px)`,
    left: "50%",
    width: 0,
    height: 0,
    pointerEvents: "none",
});

export const piece = style({
    position: "absolute",
    top: -4,
    left: -3,
    width: 7,
    height: 10,
    borderRadius: 2,
});
