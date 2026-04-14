import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const previewFrame = style({
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e0e0e0",
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    display: "flex",
    flexDirection: "column",
    maxWidth: 360,
    fontSize: "14px",
});

export const header = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
});

export const logo = style({
    height: "20px",
    width: "auto",
});

export const merchantLogo = style({
    height: "20px",
    width: "auto",
    borderRadius: alias.cornerRadius.xs,
    objectFit: "contain",
});

export const dismissIcon = style({
    background: "none",
    border: "none",
    padding: 0,
    color: vars.text.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const main = style({
    flex: 1,
    padding: alias.spacing.m,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const phoneVisual = style({
    display: "flex",
    justifyContent: "center",
    overflow: "hidden",
    alignSelf: "center",
    width: "100%",
});

export const phoneFrame = style({
    position: "relative",
    width: 320,
    height: 108,
    flexShrink: 0,
});

export const phoneImage = style({
    width: "100%",
    height: "100%",
});

export const phonePopupContent = style({
    position: "absolute",
    top: "39px",
    left: "106px",
    width: "122px",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
});

export const phonePopupTitle = style({
    fontSize: "7px",
    lineHeight: "100%",
    color: vars.text.primary,
});

export const phonePopupDesc = style({
    fontSize: "6px",
    lineHeight: "10px",
    color: vars.text.primary,
});

export const phonePopupMerchantLogo = style({
    position: "absolute",
    right: "-16px",
    bottom: "4px",
    width: "16px",
    height: "16px",
    aspectRatio: "1/1",
    borderRadius: "4px",
    objectFit: "contain",
});

export const heroSection = style({
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const heroTitle = style({
    fontSize: "18px",
    lineHeight: "26px",
    whiteSpace: "pre-line",
});

export const benefitItem = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
});

export const benefitIcon = style({
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.text.primary,
});

export const footer = style({
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    alignItems: "center",
});

export const ctaButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "10px",
    borderRadius: 10,
    fontSize: "13px",
    fontWeight: 600,
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    border: "none",
});

export const shareAgainButton = style({
    background: "none",
    border: "none",
    color: vars.text.secondary,
    fontSize: fontSize.s,
    fontWeight: 500,
    padding: alias.spacing.xs,
    textDecoration: "underline",
    textUnderlineOffset: "2px",
});
