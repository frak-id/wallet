import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const errorText = style({
    color: vars.text.error,
});

export const successIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.text.success,
});

export const merchantIcon = style({
    width: alias.size.xxl,
    height: alias.size.xxl,
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: vars.surface.muted,
    color: vars.surface.primary,
});

export const merchantImg = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

export const merchantLink = style({
    color: vars.text.action,
    textDecoration: "underline",
});

export const previousWallet = style({
    color: vars.text.secondary,
    textAlign: "center",
});

export const disclaimer = style({
    marginTop: alias.spacing.s,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    backgroundColor: vars.surface.background2,
    borderRadius: alias.cornerRadius.l,
    color: vars.text.secondary,
    fontSize: fontSize.xxs,
    lineHeight: 1.5,
    textAlign: "center",
});

export const ghostLink = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xxs,
    color: vars.text.secondary,
    fontSize: fontSize.xs,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    padding: 0,
});
