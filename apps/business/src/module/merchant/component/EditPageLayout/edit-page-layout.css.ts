import { desktop, tablet } from "@frak-labs/design-system/breakpoints";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Shared horizontal inset for the toolbar, content and footer. */
export const gutter = style({
    paddingLeft: alias.spacing.s,
    paddingRight: alias.spacing.s,
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            paddingLeft: alias.spacing.l,
            paddingRight: alias.spacing.l,
        },
        [`screen and (width > ${desktop}px)`]: {
            paddingLeft: "126px",
        },
    },
});

export const page = style({
    minHeight: "100dvh",
});

export const toolbar = style({
    paddingTop: alias.spacing.l,
    paddingBottom: alias.spacing.xs,
});

export const content = style({
    paddingTop: alias.spacing.m,
});
