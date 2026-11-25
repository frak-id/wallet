import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const card = style({
    borderRadius: alias.cornerRadius.m,
    border: `1px solid ${vars.border.default}`,
    overflow: "hidden",
    backgroundColor: vars.surface.elevated,
});

export const frame = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: alias.spacing.s,
        backgroundColor: vars.surface.muted,
        borderBottom: `1px solid ${vars.border.default}`,
    },
    variants: {
        size: {
            small: { height: "120px" },
            medium: { height: "160px" },
            large: { height: "220px" },
        },
    },
});

export const image = style({
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
});

export const fallbackIcon = style({
    color: vars.icon.tertiary,
});
