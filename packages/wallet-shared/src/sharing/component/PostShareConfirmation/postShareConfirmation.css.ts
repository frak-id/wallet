import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize, zIndex } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { tabletContainerMedia } from "../shared.css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    "@media": tabletContainerMedia,
});

export const header = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
    backgroundColor: vars.surface.background,
    position: "sticky",
    top: 0,
    zIndex: zIndex.sticky,
});

export const dismissButton = style({
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    color: vars.text.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const logo = style({
    height: "24px",
    width: "auto",
});

export const merchantLogo = style({
    height: "24px",
    width: "auto",
    borderRadius: alias.cornerRadius.xs,
    objectFit: "contain",
});

export const main = style({
    flex: 1,
    padding: alias.spacing.m,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const heroSection = style({
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const heroSectionTitle = style({
    fontSize: "20px",
    lineHeight: "30px",
    whiteSpace: "pre-line",
});

export const benefitItem = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
});

export const benefitIcon = style({
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.text.primary,
});

export const footer = style({
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
    padding: `${alias.spacing.m} ${alias.spacing.l}`,
    paddingBottom: `max(${alias.spacing.l}, env(safe-area-inset-bottom))`,
    backgroundColor: vars.surface.background,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    alignItems: "center",
});

export const ctaButton = style({
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    selectors: {
        "&:not(:disabled):active": {
            backgroundColor: vars.text.primary,
        },
    },
    "@media": {
        "(hover: hover)": {
            selectors: {
                "&:not(:disabled):hover": {
                    backgroundColor: vars.text.primary,
                },
            },
        },
    },
});

export const shareAgainButton = style({
    background: "none",
    border: "none",
    color: vars.text.secondary,
    fontSize: fontSize.s,
    fontWeight: 500,
    cursor: "pointer",
    padding: alias.spacing.xs,
    textDecoration: "underline",
    textUnderlineOffset: "2px",
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
    width: 393,
    height: 133,
    flexShrink: 0,
});

export const phoneImage = style({
    width: "100%",
    height: "100%",
});

export const phonePopupContent = style({
    position: "absolute",
    top: "48px",
    left: "130px",
    width: "150px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
});

export const phonePopupTitle = style({
    fontSize: "8.49px",
    lineHeight: "100%",
    color: vars.text.primary,
});

export const phonePopupDesc = style({
    fontSize: "7.27px",
    lineHeight: "12.13px",
    color: vars.text.primary,
});

export const phonePopupMerchantLogo = style({
    position: "absolute",
    right: "-20px",
    bottom: "5px",
    width: "20px",
    height: "20px",
    aspectRatio: "1/1",
    borderRadius: "5px",
    objectFit: "contain",
});
