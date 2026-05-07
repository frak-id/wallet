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
        borderRadius: alias.cornerRadius.full,
        cursor: "pointer",
        border: "none",
        textDecoration: "none",
        transition: "background-color 0.2s ease",
        ":focus": {
            outline: "none",
        },
        ":disabled": {
            backgroundColor: vars.surface.disabled,
            color: vars.text.disabled,
            cursor: "not-allowed",
        },
        lineHeight: "100%",
    },
    variants: {
        variant: {
            primary: {
                backgroundColor: vars.surface.primary,
                color: vars.text.onAction,
                border: "none",
                "@media": {
                    "(hover: hover)": {
                        selectors: {
                            "&:not(:disabled):hover": {
                                backgroundColor: vars.surface.primaryHover,
                            },
                            "&:not(:disabled):active": {
                                backgroundColor: vars.surface.primaryPressed,
                            },
                        },
                    },
                },
            },
            secondary: {
                backgroundColor: vars.surface.secondary,
                color: vars.text.action,
                border: "none",
                "@media": {
                    "(hover: hover)": {
                        selectors: {
                            "&:not(:disabled):hover": {
                                backgroundColor: vars.surface.secondaryHover,
                            },
                            "&:not(:disabled):active": {
                                backgroundColor: vars.surface.secondaryPressed,
                            },
                        },
                    },
                },
            },
            ghost: {
                backgroundColor: "transparent",
                color: vars.text.action,
                border: "none",
            },
            destructive: {
                backgroundColor: vars.surface.error,
                color: vars.text.error,
                border: "none",
            },
        },
        size: {
            small: {
                paddingBlock: alias.spacing.xs,
                paddingInline: alias.spacing.m,
                fontSize: fontSize.s,
                lineHeight: "21px",
                fontWeight: 600,
            },
            medium: {
                padding: alias.spacing.s,
                fontSize: fontSize.s,
                fontWeight: 600,
            },
            large: {
                padding: alias.spacing.m,
                fontSize: fontSize.m,
                fontWeight: 600,
            },
            none: {
                padding: 0,
                fontSize: fontSize.s,
                fontWeight: 600,
            },
        },
        width: {
            full: { width: "100%" },
            auto: { width: "auto" },
        },
        fontSize: {
            xs: { fontSize: fontSize.xs },
            s: { fontSize: fontSize.s },
            m: { fontSize: fontSize.m },
            l: { fontSize: fontSize.l },
            xl: { fontSize: fontSize.xl },
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "large",
        width: "full",
    },
});
