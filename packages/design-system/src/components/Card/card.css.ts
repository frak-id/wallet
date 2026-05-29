import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const card = recipe({
    base: {
        overflow: "hidden",
    },
    variants: {
        radius: {
            s: { borderRadius: alias.cornerRadius.s },
            m: { borderRadius: alias.cornerRadius.m },
            l: { borderRadius: alias.cornerRadius.l },
        },
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
        radius: "l",
        variant: "elevated",
        padding: "default",
    },
});

export const cardHeader = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    paddingBottom: alias.spacing.m,
});
