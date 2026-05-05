import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    background: vars.surface.elevated,
    borderRadius: alias.cornerRadius.l,
    overflow: "hidden",
});

export const row = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    minHeight: "49px",
});

export const codeLabel = style({
    flex: "1 0 0",
    minWidth: 0,
});

export const copyButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: vars.icon.primary,
});

export const dateValue = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    color: vars.text.primary,
});

export const dateIcon = style({
    color: vars.icon.primary,
    flexShrink: 0,
});
