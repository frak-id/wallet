import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const hero = style({
    backgroundColor: vars.surface.overlay,
});

export const headerSection = style({
    alignItems: "center",
    textAlign: "center",
});

export const heroIconWrapper = style({
    position: "relative",
    flexShrink: 0,
    width: 64,
    height: 64,
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.tertiary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const heroBadge = style({
    position: "absolute",
    bottom: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: alias.cornerRadius.full,
    padding: 3,
    background: vars.surface.background,
});

export const heroBadgeInner = recipe({
    base: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: alias.cornerRadius.full,
    },
    variants: {
        status: {
            pending: { background: vars.icon.warning },
            rejected: { background: vars.icon.error },
        },
    },
});
