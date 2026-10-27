import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const sheet = style({
    display: "flex",
    flexDirection: "column",
    paddingInline: alias.spacing.m,
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.l,
});

export const header = style({
    display: "flex",
    paddingBlock: alias.spacing.s,
});
