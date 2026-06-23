import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Shared horizontal inset for the toolbar, content and footer. */
export const gutter = style({
    paddingLeft: "126px",
    paddingRight: alias.spacing.l,
    "@media": {
        "screen and (max-width: 1024px)": {
            paddingLeft: alias.spacing.l,
        },
        "screen and (max-width: 768px)": {
            paddingLeft: alias.spacing.s,
            paddingRight: alias.spacing.s,
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
    maxWidth: "720px",
    paddingTop: alias.spacing.m,
});
