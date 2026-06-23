import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const form = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const blobContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    paddingTop: alias.spacing.s,
});
