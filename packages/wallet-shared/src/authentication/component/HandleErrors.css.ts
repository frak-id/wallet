import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
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

export const header = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const iconWrapper = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "20px",
    height: "20px",
});

export const iconTone = styleVariants({
    neutral: { color: vars.icon.secondary },
    warning: { color: vars.icon.warning },
    danger: { color: vars.icon.error },
});

export const title = style({
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.3,
    color: vars.text.primary,
});

export const description = style({
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: vars.text.secondary,
});

export const steps = style({
    margin: 0,
    paddingLeft: "1.15rem",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    fontSize: "14px",
    lineHeight: 1.5,
    color: vars.text.secondary,
});

export const retryButton = style({
    marginTop: alias.spacing.xxs,
});
