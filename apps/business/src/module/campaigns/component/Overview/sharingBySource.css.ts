import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const legendItemActive = style({
    backgroundColor: vars.surface.secondary,
});

export const legendItemDimmed = style({
    opacity: 0.5,
});
