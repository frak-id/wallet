import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const noticeVariants = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        gap: alias.spacing.xxs,
        fontSize: "12px",
        lineHeight: "20px",
    },
    variants: {
        tone: {
            info: {
                backgroundColor: vars.surface.secondary,
                color: vars.text.action,
            },
            warning: {
                backgroundColor: vars.surface.warning,
                color: vars.text.warning,
            },
            error: {
                backgroundColor: vars.surface.error,
                color: vars.text.error,
            },
            success: {
                backgroundColor: vars.surface.success,
                color: vars.text.success,
            },
            neutral: {
                backgroundColor: vars.surface.muted,
                color: vars.text.secondary,
            },
        },
        display: {
            // Full-width tinted container. Radius/padding chosen to match the
            // business `infoBar` (the common block case) with zero delta —
            // including its asymmetric padding (start `m`, end `l`).
            block: {
                width: "100%",
                borderRadius: alias.cornerRadius.m,
                paddingInlineStart: alias.spacing.m,
                paddingInlineEnd: alias.spacing.l,
                paddingBlock: alias.spacing.s,
            },
            // Pill chip. Matches wallet `Notice` (Badge `info`) with zero delta.
            inline: {
                display: "inline-flex",
                borderRadius: alias.cornerRadius.full,
                paddingInline: alias.spacing.xs,
                paddingBlock: alias.spacing.xxs,
            },
        },
    },
    defaultVariants: { tone: "info", display: "block" },
});

export const icon = style({ flexShrink: 0, display: "inline-flex" });

/**
 * Content slot wrapping `children`. Fills the remaining row width (the root
 * is a flex row, which would otherwise let content sit at its natural width
 * inside a full-width block Notice) and allows text to shrink/wrap.
 */
export const content = style({ flex: "1 1 auto", minWidth: 0 });
