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
        // Declared after `variant` so its background wins over the surface one.
        tone: {
            error: {
                backgroundColor: vars.surface.error,
            },
        },
        padding: {
            none: { padding: "0" },
            compact: { padding: alias.spacing.s },
            default: { padding: alias.spacing.m },
            cell: {
                paddingBlock: alias.spacing.s,
                paddingInline: alias.spacing.m,
            },
        },
        // `border.focus` vanishes on a white card, so the ring uses the action colour.
        selected: {
            true: {
                outline: `1.5px solid ${vars.text.action}`,
                outlineOffset: "-1.5px",
            },
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
