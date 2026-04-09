import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const checkBadge = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: alias.cornerRadius.full,
    background: vars.icon.success,
    flexShrink: 0,
});

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const hero = style({
    backgroundColor: vars.surface.overlay,
});

export const headerSection = style({
    alignItems: "center",
    textAlign: "center",
});
