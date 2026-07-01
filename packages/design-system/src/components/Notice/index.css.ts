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
            // business `infoBar` (the common block case) with zero delta.
            block: {
                width: "100%",
                borderRadius: alias.cornerRadius.m,
                paddingInline: alias.spacing.m,
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
