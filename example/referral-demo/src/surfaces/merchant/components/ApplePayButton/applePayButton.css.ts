import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { fonts } from "@/shell/device.css";
import { pressable } from "../page.css";

export const button = recipe({
    base: [
        pressable,
        {
            appearance: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            padding: "0 16px",
            border: 0,
            background: "#000",
            color: "#fff",
            fontFamily: fonts.system,
            letterSpacing: "-0.01em",
        },
    ],
    variants: {
        size: {
            regular: { height: 52, borderRadius: 8 },
            compact: { height: 46, borderRadius: 6 },
        },
    },
    defaultVariants: { size: "regular" },
});

export const label = style({
    fontSize: 17,
    fontWeight: 500,
});

export const mark = style({
    display: "inline-flex",
    alignItems: "center",
    gap: 1,
    fontSize: 20,
    fontWeight: 600,
});

export const logo = style({ marginTop: -3 });
