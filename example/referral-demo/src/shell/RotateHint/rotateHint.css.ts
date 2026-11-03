import { style } from "@vanilla-extract/css";
import { fonts } from "../device.css";

export const overlay = style({
    position: "fixed",
    inset: 0,
    zIndex: 300,
    display: "none",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
    background: "#060b1f",
    color: "#fff",
    fontFamily: fonts.inter,
    textAlign: "center",
    "@media": {
        "(orientation: landscape) and (max-height: 500px)": {
            display: "flex",
        },
    },
});

export const text = style({
    maxWidth: 280,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.4,
});
