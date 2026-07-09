import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";

export const numberedCircle = recipe({
    base: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 600,
        lineHeight: 1,
        borderWidth: 2,
        borderStyle: "solid",
    },
    variants: {
        size: {
            sm: { width: 24, height: 24, fontSize: "12px" },
            md: { width: 32, height: 32, fontSize: "14px" },
            lg: { width: 40, height: 40, fontSize: "16px" },
        },
        color: {
            primary: {
                borderColor: vars.text.primary,
                color: vars.text.primary,
            },
            secondary: {
                borderColor: vars.text.secondary,
                color: vars.text.secondary,
            },
            action: {
                borderColor: vars.text.action,
                color: vars.text.action,
            },
            filled: {
                backgroundColor: vars.text.primary,
                color: vars.text.onAction,
                borderColor: "transparent",
            },
        },
    },
    defaultVariants: {
        size: "md",
        color: "primary",
    },
});
