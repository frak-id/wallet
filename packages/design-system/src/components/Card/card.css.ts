import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const card = recipe({
    base: {
        borderRadius: alias.cornerRadius.l,
        overflow: "hidden",
    },
    variants: {
        variant: {
            elevated: {
                backgroundColor: vars.surface.elevated,
            },
            muted: {
                backgroundColor: vars.surface.muted,
            },
            secondary: {
                backgroundColor: vars.surface.secondary,
            },
        },
        padding: {
            none: { padding: "0" },
            compact: { padding: alias.spacing.s },
            default: { padding: alias.spacing.m },
        },
    },
    defaultVariants: {
        variant: "elevated",
        padding: "default",
    },
});
