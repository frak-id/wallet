import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const badgeVariants = recipe({
    base: {
        display: "inline-flex",
        alignItems: "center",
        borderRadius: alias.cornerRadius.full,
        fontWeight: 600,
        whiteSpace: "nowrap" as const,
    },
    variants: {
        variant: {
            success: {
                backgroundColor: vars.surface.success,
                color: vars.text.success,
            },
            warning: {
                backgroundColor: vars.surface.warning,
                color: vars.text.warning,
            },
            error: {
                backgroundColor: vars.surface.error,
                color: vars.text.error,
            },
            info: {
                backgroundColor: vars.surface.secondary,
                color: vars.text.action,
            },
            neutral: {
                backgroundColor: vars.surface.muted,
                color: vars.text.secondary,
            },
            disabled: {
                backgroundColor: vars.surface.disabled,
                color: vars.text.secondary,
            },
        },
        size: {
            small: {
                paddingTop: alias.spacing.xxs,
                paddingBottom: alias.spacing.xxs,
                paddingLeft: alias.spacing.xs,
                paddingRight: alias.spacing.xs,
                fontSize: "10px",
                lineHeight: "12px",
            },
            medium: {
                paddingTop: alias.spacing.xxs,
                paddingBottom: alias.spacing.xxs,
                paddingLeft: alias.spacing.xs,
                paddingRight: alias.spacing.xs,
                fontSize: "12px",
                lineHeight: 1,
            },
        },
    },
    defaultVariants: {
        variant: "neutral",
        size: "medium",
    },
});
