import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    padding: `0 ${alias.spacing.m}`,
});

export const link = style({
    color: vars.text.action,
    textDecoration: "none",
});
