import { vars } from "@frak-labs/design-system/theme";
import { brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const sso__grid = style({
    marginTop: 0,
});

export const sso__logo = style({
    margin: `0 auto ${brand.scale[600]} auto`,
    display: "block",
    maxWidth: "70%",
});

export const sso__title = style({
    fontSize: "29px",
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.primary,
});

export const sso__ahead = style({
    fontSize: fontSize.xs,
});

export const sso__previousWallet = style({
    fontSize: fontSize.xs,
    maxWidth: "70%",
    margin: `${brand.scale[500]} auto 0`,
    textAlign: "center",
});

export const sso__link = style({
    color: vars.text.action,
});

export const sso__buttonLink = style({
    all: "unset",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "13px",
});

export const sso__notice = style({
    color: vars.text.secondary,
    fontSize: "11px",
});

export const sso__primaryButtonWrapper = style({
    marginTop: brand.scale[600],
    textAlign: "center",
});

export const sso__secondaryButtonWrapper = style({
    marginTop: brand.scale[500],
    textAlign: "center",
});

export const sso__recover = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[100],
    marginTop: brand.scale[300],
    color: vars.text.secondary,
    fontSize: "11px",
});

export const sso__redirect = style({
    marginTop: brand.scale[500],
});

export const errorText = style({
    color: vars.text.error,
});
