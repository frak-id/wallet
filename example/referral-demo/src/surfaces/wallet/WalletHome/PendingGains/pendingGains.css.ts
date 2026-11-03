import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const closeButton = style({
    position: "absolute",
    top: alias.spacing.m,
    right: alias.spacing.m,
    width: 32,
    height: 32,
    display: "grid",
    placeItems: "center",
    padding: 0,
    border: 0,
    borderRadius: alias.cornerRadius.full,
    background: "transparent",
    color: vars.icon.primary,
    cursor: "pointer",
});

export const sheetBody = style({
    textAlign: "center",
});

export const amountBlock = style({
    padding: alias.spacing.m,
});

export const amount = style({
    fontSize: fontSize["4xl"],
    fontWeight: 700,
    lineHeight: 1.1,
    color: vars.text.success,
});

export const heading = style({
    whiteSpace: "pre-line",
});

export const collectCard = style({
    position: "relative",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    background: vars.surface.elevated,
    textAlign: "center",
    boxShadow: "0 12px 32px -16px rgba(9, 190, 103, 0.45)",
    outline: `1.5px solid ${vars.border.success}`,
    outlineOffset: "-1.5px",
});
