import { alias, fontSize, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const back = style({
    marginLeft: alias.spacing.m,
    marginBottom: `calc(-1 * ${alias.spacing.xs})`,
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
