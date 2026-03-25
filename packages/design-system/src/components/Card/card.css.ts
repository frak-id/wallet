import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const card = recipe({
    base: {
        borderRadius: alias.cornerRadius.xl,
        overflow: "hidden",
    },
    variants: {
        variant: {
            elevated: {
                backgroundColor: vars.surface.elevated,
                border: `1px solid ${vars.border.subtle}`,
            },
            muted: {
                backgroundColor: vars.surface.muted,
            },
        },
        padding: {
            none: { padding: "0" },
            compact: { padding: alias.spacing.xs },
            default: { padding: alias.spacing.m },
        },
    },
    defaultVariants: {
        variant: "elevated",
        padding: "default",
    },
});
