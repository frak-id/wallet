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
        selectors: {
            '&[aria-disabled="true"]': {
                backgroundColor: vars.surface.disabled,
                color: vars.text.disabled,
                cursor: "not-allowed",
                pointerEvents: "none",
            },
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
            /**
             * Filter chip — neutral grey card used for dashboard
             * filter triggers (date range, status, etc.). Square-ish
             * 12px radius, Body-Secondary Medium label.
             */
            filter: {
                backgroundColor: vars.surface.disabled,
                color: vars.text.primary,
                borderRadius: alias.cornerRadius.m,
                border: "none",
                "@media": {
                    "(hover: hover)": {
                        selectors: {
                            "&:not(:disabled):hover": {
                                backgroundColor: "#d4d4d4",
                            },
                        },
                    },
                },
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
            filter: {
                height: "36px",
                paddingBlock: 0,
                paddingInline: alias.spacing.m,
                fontSize: fontSize.s,
                lineHeight: "22px",
                fontWeight: 500,
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
