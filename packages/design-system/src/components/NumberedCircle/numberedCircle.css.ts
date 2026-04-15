import { styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
} as const;

export const sizeVariants = styleVariants({
    sm: {
        ...base,
        width: 24,
        height: 24,
        fontSize: "12px",
        lineHeight: 1,
        fontWeight: 600,
        borderWidth: 2,
        borderStyle: "solid",
    },
    md: {
        ...base,
        width: 32,
        height: 32,
        fontSize: "14px",
        lineHeight: 1,
        fontWeight: 600,
        borderWidth: 2,
        borderStyle: "solid",
    },
    lg: {
        ...base,
        width: 40,
        height: 40,
        fontSize: "16px",
        lineHeight: 1,
        fontWeight: 600,
        borderWidth: 2,
        borderStyle: "solid",
    },
});

export const colorVariants = styleVariants({
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
});
