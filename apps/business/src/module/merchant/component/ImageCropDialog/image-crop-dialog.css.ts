import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// react-easy-crop positions its container absolutely: this box gives it a size.
export const cropArea = style({
    position: "relative",
    width: "100%",
    height: "320px",
    borderRadius: alias.cornerRadius.m,
    overflow: "hidden",
    backgroundColor: vars.surface.tertiary,
});

export const zoomSlider = style({
    width: "100%",
    margin: 0,
    accentColor: vars.surface.primary,
    cursor: "pointer",
});
