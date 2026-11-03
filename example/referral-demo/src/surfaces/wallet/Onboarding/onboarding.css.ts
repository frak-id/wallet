import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { deviceInset, fonts } from "@/shell/device.css";

export const screen = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: vars.surface.background,
    fontFamily: fonts.inter,
});

export const page = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    paddingTop: `calc(${deviceInset.top} + ${alias.spacing.m})`,
    paddingBottom: deviceInset.bottom,
});

export const header = style({
    flexShrink: 0,
    height: 40,
    display: "flex",
    alignItems: "center",
    paddingInline: alias.spacing.s,
    marginBottom: alias.spacing.m,
});

export const backButton = style({
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    border: 0,
    borderRadius: alias.cornerRadius.full,
    background: "transparent",
    color: vars.icon.primary,
    cursor: "pointer",
});

export const footer = style({
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
    paddingTop: alias.spacing.l,
});

export const dots = style({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: alias.spacing.xxs,
    height: 6,
});

export const dot = recipe({
    base: {
        width: 6,
        height: 6,
        borderRadius: alias.cornerRadius.full,
        transition: "transform 0.25s ease-out, opacity 0.25s ease-out",
    },
    variants: {
        active: {
            true: {
                background: vars.icon.action,
                transform: "scale(1)",
            },
            false: {
                background: vars.icon.disabled,
                opacity: 0.7,
                transform: "scale(0.6667)",
            },
        },
    },
});
