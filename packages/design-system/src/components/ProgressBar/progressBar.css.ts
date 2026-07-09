import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const track = style({
    width: "100%",
    height: "6px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.disabled,
    overflow: "hidden",
});

export const fill = style({
    height: "100%",
    borderRadius: alias.cornerRadius.full,
    transition: "width 0.3s ease",
});

export const fillTones = recipe({
    variants: {
        tone: {
            primary: { backgroundColor: vars.surface.primary },
            success: { backgroundColor: vars.icon.success },
        },
    },
    defaultVariants: {
        tone: "primary",
    },
});
