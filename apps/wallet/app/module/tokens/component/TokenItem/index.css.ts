import {
    alias,
    easing,
    fontSize,
    transition,
} from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const tokenItem = style({
    display: "flex",
    alignItems: "center",
    gap: "var(--frak-spacing-s)",
    fontSize: fontSize.m,
});

export const tokenButton = style({
    all: "unset",
    display: "flex",
    alignItems: "center",
    gap: "var(--frak-spacing-s)",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    borderRadius: "var(--frak-radius-s)",
    cursor: "pointer",
    transition: `background ${transition.base} ${easing.inOut}`,
    selectors: {
        "&:hover": {
            backgroundColor: "var(--frak-token-item-hover-color)",
        },
    },
});

export const tokenAmount = style({
    fontWeight: "var(--brand-fontweight-bold)",
});
