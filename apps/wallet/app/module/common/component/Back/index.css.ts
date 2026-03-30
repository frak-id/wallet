import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const back = style({
    marginLeft: alias.spacing.m,
    marginBottom: `calc(-1 * ${alias.spacing.xs})`,
});

export const backDisabled = style({
    color: vars.text.disabled,
});

/** Liquid Glass circle — iOS 26 style, using Figma-exported WebP */
export const glassCircle = style({
    position: "relative",
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
});

export const glassImage = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
});

export const glassIcon = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
});

export const actionButton = style({
    all: "unset",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.s,
    transition: `color ${transition.base}`,
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
        },
    },
});

export const actionText = style({
    fontSize: fontSize.l,
});
