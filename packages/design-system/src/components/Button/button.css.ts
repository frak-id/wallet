import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, fontSize } from "../../tokens.css";

export const button = recipe({
    base: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: alias.spacing.s,
        width: "100%",
        borderRadius: alias.cornerRadius.full,
        cursor: "pointer",
        border: "none",
        textDecoration: "none",
        transition: "background-color 0.2s ease",
        ":focus": {
            outline: "none",
        },
    },
    variants: {
        variant: {
            primary: {
                backgroundColor: vars.surface.primary,
                color: vars.text.onAction,
                border: "none",
                ":hover": {
                    backgroundColor: vars.surface.primaryHover,
                },
                ":active": {
                    backgroundColor: vars.surface.primaryPressed,
                },
            },
            outlined: {
                backgroundColor: "transparent",
                color: vars.text.action,
                border: `1px solid ${vars.border.default}`,
                ":hover": {
                    backgroundColor: vars.surface.secondary,
                },
            },
            ghost: {
                backgroundColor: "transparent",
                color: vars.text.action,
                border: "none",
            },
        },
        size: {
            small: {
                padding: alias.spacing.s,
                fontSize: fontSize.xs,
            },
            large: {
                padding: alias.spacing.m,
                fontSize: fontSize.s,
            },
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "large",
    },
});
