import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const container = style({
    borderRadius: alias.cornerRadius.m,
    borderWidth: alias.borderWidth.xs,
    borderStyle: "solid",
    textAlign: "left",
    width: "100%",
});

export const containerTone = styleVariants({
    neutral: {
        backgroundColor: vars.surface.secondary,
        borderColor: vars.border.subtle,
    },
    warning: {
        backgroundColor: vars.surface.warning,
        borderColor: vars.border.warning,
    },
    danger: {
        backgroundColor: vars.surface.error,
        borderColor: vars.border.error,
    },
});

export const iconTone = styleVariants({
    neutral: { color: vars.icon.secondary },
    warning: { color: vars.icon.warning },
    danger: { color: vars.icon.error },
});

export const steps = style({
    margin: 0,
    paddingLeft: "1.15rem",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const retryButton = style({
    marginTop: alias.spacing.xxs,
});
