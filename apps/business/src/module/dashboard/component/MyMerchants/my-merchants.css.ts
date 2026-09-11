import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const readOnlySection = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    marginTop: alias.spacing.l,
});

export const readOnlyTitle = style({
    margin: 0,
});
