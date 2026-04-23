import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const ssoHeader = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    paddingInline: alias.spacing.m,
    color: vars.surface.primary,
});

export const ssoHeader__title = style({
    color: vars.text.secondary,
});
