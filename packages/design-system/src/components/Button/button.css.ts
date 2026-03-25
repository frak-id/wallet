import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, fontSize } from "../../tokens.css";

export const button = recipe({
    base: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: alias.spacing.xs,
        width: "100%",
        borderRadius: alias.cornerRadius.full,
        cursor: "pointer",
        border: "none",
        textDecoration: "none",
        transition: "background-color 0.2s ease",
        ":focus": {
            outline: "none",
        },
        lineHeight: "100%",
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
            secondary: {
                backgroundColor: vars.surface.secondary,
                color: vars.text.action,
                border: "none",
                ":hover": {
                    backgroundColor: vars.surface.secondaryHover,
                },
                ":active": {
                    backgroundColor: vars.surface.secondaryPressed,
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
                padding: alias.spacing.xs,
                fontSize: fontSize.xs,
            },
            large: {
                padding: alias.spacing.m,
                fontSize: fontSize.m,
                fontWeight: 600,
            },
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "large",
    },
});
