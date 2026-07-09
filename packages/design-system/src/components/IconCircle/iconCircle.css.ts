import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const iconCircle = recipe({
    base: {
        borderRadius: alias.cornerRadius.full,
        backgroundColor: vars.surface.secondary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: vars.icon.tertiary,
        flexShrink: 0,
    },
    variants: {
        size: {
            sm: { width: "32px", height: "32px" },
            md: { width: "48px", height: "48px" },
            lg: { width: "56px", height: "56px" },
        },
        // Color tones layered on top of the base. `neutral` keeps the base
        // surface/icon colors; `action` tints the icon brand-blue (the base
        // already paints the light-blue disc). Declared after `size` so the
        // tone color wins over the base.
        tone: {
            neutral: {},
            action: {
                color: vars.icon.action,
            },
        },
    },
    defaultVariants: {
        size: "md",
        tone: "neutral",
    },
});
