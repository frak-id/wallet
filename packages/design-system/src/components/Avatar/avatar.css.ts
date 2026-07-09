import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, brand, fontSize } from "../../tokens.css";

export const avatarSizes = recipe({
    base: {
        borderRadius: alias.cornerRadius.full,
        backgroundColor: vars.surface.secondary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: vars.text.action,
        fontSize: fontSize.s,
        lineHeight: "22px",
        fontWeight: brand.typography.fontWeight.medium,
        flexShrink: 0,
        userSelect: "none",
    },
    variants: {
        size: {
            s: { width: "32px", height: "32px" },
            m: { width: "40px", height: "40px" },
        },
    },
    defaultVariants: {
        size: "m",
    },
});
