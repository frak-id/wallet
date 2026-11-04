import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { deviceInset, fonts } from "@/shell/device.css";

export const screen = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    paddingTop: `calc(${deviceInset.top} + ${alias.spacing.m})`,
    paddingBottom: deviceInset.bottom,
    background: vars.surface.background,
    color: vars.text.primary,
    fontFamily: fonts.inter,
});

export const body = style({
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
});

export const bodyContent = style({
    marginBlock: "auto",
});

export const cross = style({
    color: vars.text.tertiary,
    fontSize: 18,
});

export const frakBadge = style({
    display: "block",
    borderRadius: alias.cornerRadius.m,
});

export const checkIcon = style({
    flexShrink: 0,
    color: vars.icon.success,
});

export const footer = style({
    flexShrink: 0,
});
