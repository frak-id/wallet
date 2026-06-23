import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const fieldCard = style({
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.m,
});

export const inputLabel = style({
    paddingInline: alias.spacing.m,
});
