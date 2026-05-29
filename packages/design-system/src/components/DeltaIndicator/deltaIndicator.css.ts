import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";

export const deltaIndicator = recipe({
    base: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
    },
    variants: {
        size: {
            s: { fontSize: "12px", lineHeight: "20px" },
            m: { fontSize: "14px", lineHeight: "22px" },
        },
        tone: {
            up: { color: vars.text.success },
            down: { color: vars.text.warning },
            neutral: { color: vars.text.tertiary },
        },
    },
    defaultVariants: {
        size: "m",
        tone: "neutral",
    },
});
