import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Outer preview wrapper — scaled-down phone-like frame.
 */
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

/**
 * Header — logo + dismiss, mirrors sharingPage.css header.
 */
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

export const dismissText = style({
    fontSize: "13px",
    fontWeight: 700,
    color: vars.text.primary,
});

/**
 * Main content area.
 */
export const main = style({
    flex: 1,
    padding: alias.spacing.m,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

/**
 * Credit card visual.
 */
export const creditCard = style({
    position: "relative",
    width: "100%",
    maxWidth: 280,
    aspectRatio: "330 / 171",
    borderRadius: 16,
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
    padding: `${alias.spacing.m} ${alias.spacing.s}`,
    color: "#fff",
});

export const creditCardTop = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    marginTop: "2px",
    marginLeft: "42px",
    marginRight: "34px",
});

export const creditCardAmount = style({
    display: "inline-flex",
    alignItems: "flex-start",
    gap: "2px",
    fontSize: "34px",
    fontWeight: 700,
    lineHeight: 1,
});

export const creditCardCurrency = style({
    fontSize: "18px",
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
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: "16px",
});

export const creditCardLogo = style({
    height: 26,
    width: "auto",
    objectFit: "contain",
    borderRadius: "5px",
});

/**
 * Reward card section (title + tagline).
 */
export const rewardCard = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    textAlign: "center",
});

/**
 * Stepper — numbered steps with connecting lines.
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
 * Footer — share + copy buttons.
 */
export const footer = style({
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    boxShadow: "2px 0px 8px 0px #00000029",
});

export const shareButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px",
    borderRadius: 10,
    fontSize: "13px",
    fontWeight: 600,
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    textTransform: "uppercase",
    border: "none",
});

export const copyButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px",
    borderRadius: 10,
    fontSize: "13px",
    fontWeight: 600,
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    border: `1.5px solid ${vars.text.primary}`,
    textTransform: "uppercase",
});
