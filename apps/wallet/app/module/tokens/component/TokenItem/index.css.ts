import { vars } from "@frak-labs/design-system/theme";
import {
    alias,
    brand,
    easing,
    fontSize,
    transition,
} from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const tokenItem = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    fontSize: fontSize.m,
});

export const tokenButton = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.s,
    cursor: "pointer",
    transition: `background ${transition.base} ${easing.inOut}`,
    selectors: {
        "&:hover": {
            backgroundColor: vars.surface.secondaryHover,
        },
    },
});

export const tokenAmount = style({
    fontWeight: brand.typography.fontWeight.bold,
});
