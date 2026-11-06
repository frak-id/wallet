import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts } from "../device.css";

export const prompt = recipe({
    base: {
        position: "absolute",
        zIndex: 40,
        left: 16,
        right: 16,
        bottom: `calc(${deviceInset.bottom} + 12px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 52,
        border: 0,
        borderRadius: 26,
        background: "rgba(6, 11, 31, 0.92)",
        color: "#fff",
        fontFamily: fonts.inter,
        fontSize: 15,
        fontWeight: 600,
        boxShadow: "0 12px 32px rgba(6, 11, 31, 0.35)",
        backdropFilter: "blur(12px)",
        cursor: "pointer",
    },
    variants: {
        shown: { true: {}, false: { pointerEvents: "none" } },
    },
});

export const logo = style({
    display: "grid",
    placeItems: "center",
    width: 24,
    height: 24,
    borderRadius: 8,
    background: "#fff",
    color: brand.colors.primary[600],
});
