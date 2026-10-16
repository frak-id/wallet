import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const headerSection = style({
    alignItems: "center",
    textAlign: "center",
});

export const heroIconWrapper = style({
    position: "relative",
    flexShrink: 0,
    width: 64,
    height: 64,
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.tertiary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});
