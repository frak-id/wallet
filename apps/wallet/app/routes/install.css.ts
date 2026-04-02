import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const wrapper = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.l,
    padding: `${alias.spacing.l} ${alias.spacing.m}`,
    textAlign: "center",
});

export const description = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    lineHeight: 1.5,
    maxWidth: 360,
});

export const codeSection = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.s,
    width: "100%",
});

export const codeLabel = style({
    fontSize: fontSize.s,
    fontWeight: 600,
    color: vars.text.secondary,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
});

export const codeDisplay = style({
    display: "flex",
    gap: alias.spacing.s,
    justifyContent: "center",
});

export const codeChar = style({
    width: 44,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: alias.cornerRadius.m,
    background: vars.surface.muted,
    fontSize: fontSize.xl,
    fontWeight: 700,
    color: vars.text.primary,
    userSelect: "all",
});

export const codeHint = style({
    fontSize: fontSize.s,
    color: vars.text.disabled,
    lineHeight: 1.4,
    maxWidth: 300,
});

export const storeLinks = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
    maxWidth: 360,
});

export const savedBanner = style({
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.m,
    background: vars.surface.muted,
    fontSize: fontSize.s,
    color: vars.text.secondary,
    lineHeight: 1.4,
});

export const errorText = style({
    color: vars.text.error,
    fontSize: fontSize.s,
});

const storeLinkBase = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${alias.spacing.m} ${alias.spacing.l}`,
    borderRadius: alias.cornerRadius.m,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: fontSize.m,
    width: "100%",
    textAlign: "center",
});

export const storeLink = style([
    storeLinkBase,
    {
        background: vars.surface.primary,
        color: vars.text.onAction,
    },
]);

export const storeLinkSecondary = style([
    storeLinkBase,
    {
        background: vars.surface.muted,
        color: vars.text.primary,
    },
]);
