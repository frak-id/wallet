import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    overflow: "hidden",
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});

export const layoutRow = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: "inherit",
    font: "inherit",
});

export const iconBubble = style({
    flex: "0 0 auto",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: vars.surface.secondary,
    color: vars.icon.action,
});

export const textBlock = style({
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    minWidth: 0,
});

export const chevron = style({
    flex: "0 0 auto",
    color: vars.icon.secondary,
});
