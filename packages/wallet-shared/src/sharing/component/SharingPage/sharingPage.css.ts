import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize, zIndex } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
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
    color: vars.text.primary,
    fontSize: "15px",
    fontWeight: 700,
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
    padding: `${alias.spacing.m}`,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const creditCard = style({
    position: "relative",
    width: "100%",
    maxWidth: 330,
    aspectRatio: "330 / 171",
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "center",
});

export const creditCardBg = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
});

export const creditCardContent = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
    padding: `${alias.spacing.l} ${alias.spacing.m}`,
    color: "#fff",
});

export const creditCardTop = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    marginTop: "4px",
    marginLeft: "51px",
    marginRight: "42px",
});

export const creditCardAmount = style({
    display: "inline-flex",
    alignItems: "flex-start",
    gap: "2px",
    fontSize: "42px",
    fontWeight: 700,
    lineHeight: 1,
});

export const creditCardCurrency = style({
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1,
});

export const creditCardLabel = style({
    fontSize: fontSize.s,
    fontWeight: 600,
    lineHeight: "100%",
});

export const creditCardBottom = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
});

export const creditCardBottomText = style({
    fontSize: fontSize.s,
    fontWeight: 400,
    lineHeight: "20px",
});

export const creditCardLogo = style({
    height: 32,
    width: "auto",
    objectFit: "contain",
    borderRadius: "6px",
});

export const rewardCard = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    textAlign: "center",
});

export const productCard = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
    backgroundColor: "#fff",
    border: "1px solid #F1EFEE",
    borderRadius: alias.cornerRadius.l,
});

export const productImage = style({
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.s,
    objectFit: "cover",
    backgroundColor: vars.surface.elevated,
    border: `1px solid ${vars.border.subtle}`,
    boxShadow: "0px 2px 16px 0px #00000026",
});

export const checkIcon = style({
    width: "24px",
    height: "24px",
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: fontSize.xs,
    flexShrink: 0,
});

/**
 * Stepper — numbered steps with a vertical connecting line.
 */
export const stepper = style({
    display: "flex",
    flexDirection: "column",
    position: "relative",
    gap: alias.spacing.m,
    paddingInlineStart: 0,
    listStyle: "none",
    margin: 0,
});

export const stepItem = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
    position: "relative",
});

/**
 * Vertical connector line between numbered circles.
 * Positioned from bottom of current circle to top of next circle.
 */
export const stepConnector = style({
    position: "absolute",
    left: 14,
    top: 32,
    bottom: -16,
    width: 4,
    backgroundColor: vars.border.default,
});

export const stepConnectorDark = style({
    position: "absolute",
    left: 14,
    top: 32,
    bottom: -16,
    width: 4,
    background: `linear-gradient(to bottom, ${vars.text.primary} 50%, ${vars.border.default} 50%)`,
});

export const stepDescription = style({
    color: "#979797",
});

/**
 * FAQ accordion — cards with gaps, no borders between items.
 */
export const faqWrapper = style({
    paddingTop: alias.spacing.m,
    borderTop: "1px solid #F1EFEE",
});

export const faqTitle = style({
    fontSize: "20px",
    lineHeight: "normal",
});

export const faqList = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const faqItem = style({
    backgroundColor: vars.surface.muted,
    borderRadius: alias.cornerRadius.m,
    paddingInline: alias.spacing.m,
    borderBottom: "none",
});

export const faqTrigger = style({
    paddingBlock: alias.spacing.m,
    fontSize: fontSize.s,
    fontWeight: 600,
    textAlign: "left",
});

/** Hide the default chevron in FAQ triggers */
globalStyle(`${faqTrigger} > svg:last-child`, {
    display: "none",
});

export const faqIcon = style({
    flexShrink: 0,
    color: "#BBC4CD",
});

export const faqIconMinus = style({
    display: "none",
    selectors: {
        "[data-state='open'] > &": {
            display: "block",
        },
    },
});

export const faqIconPlus = style({
    display: "block",
    selectors: {
        "[data-state='open'] > &": {
            display: "none",
        },
    },
});

export const faqContent = style({
    paddingBottom: alias.spacing.m,
    fontSize: fontSize.s,
    color: vars.text.secondary,
    lineHeight: 1.5,
});

export const legalLinks = style({
    display: "flex",
    justifyContent: "center",
    gap: alias.spacing.m,
});

export const legalLink = style({
    color: "#979797",
    fontSize: "11px",
    textDecoration: "none",
    selectors: {
        "&:hover": {
            textDecoration: "underline",
        },
    },
});

/**
 * Sticky footer — follows the DetailSheetFooter pattern.
 * Buttons stacked vertically, safe area insets respected.
 */
export const footer = style({
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
    padding: `${alias.spacing.m} ${alias.spacing.l}`,
    paddingBottom: `max(${alias.spacing.l}, env(safe-area-inset-bottom))`,
    backgroundColor: vars.surface.background,
    boxShadow: "2px 0px 8px 0px #00000029",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
});

export const shareButton = style({
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    textTransform: "uppercase",
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

export const copyButton = style({
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    border: `1.5px solid ${vars.text.primary}`,
    textTransform: "uppercase",
    selectors: {
        "&:not(:disabled):active": {
            backgroundColor: vars.surface.background,
        },
    },
    "@media": {
        "(hover: hover)": {
            selectors: {
                "&:not(:disabled):hover": {
                    backgroundColor: vars.surface.background,
                },
            },
        },
    },
});
