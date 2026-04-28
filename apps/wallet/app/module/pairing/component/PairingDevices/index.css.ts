import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const deviceIcon = style({
    width: 48,
    height: 48,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: vars.surface.tertiary,
    color: vars.icon.primary,
});

export const deviceIconSvg = style({
    width: 24,
    height: 24,
});

export const connector = style({
    width: 24,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
});

export const connectorIcon = style({
    width: 24,
    height: 24,
    color: vars.icon.primary,
});
