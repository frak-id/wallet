import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { fonts } from "../device.css";

export const bar = recipe({
    base: {
        position: "absolute",
        insetInline: 0,
        top: 0,
        height: 54,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingInline: "40px 30px",
        paddingTop: 4,
        fontFamily: fonts.system,
        pointerEvents: "none",
        transition: "color 240ms ease",
    },
    variants: {
        tone: {
            dark: { color: "#000" },
            light: { color: "#fff" },
        },
    },
});

export const time = style({
    width: 54,
    textAlign: "center",
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: "-0.02em",
});

export const icons = style({
    display: "flex",
    alignItems: "center",
    gap: 6,
    fill: "currentColor",
});
