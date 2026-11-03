import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize, zIndex } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { fonts } from "@/shell/device.css";

export const container = style({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overscrollBehavior: "contain",
    backgroundColor: vars.surface.background,
    color: vars.text.primary,
    fontFamily: fonts.inter,
});

export const inert = style({
    pointerEvents: "none",
    overflow: "hidden",
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
    padding: 0,
    border: "none",
    background: "none",
    color: vars.text.primary,
    fontFamily: "inherit",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
});

export const logo = style({
    height: "24px",
    width: "auto",
});

export const merchantLogo = style({
    display: "block",
    width: 24,
    height: 24,
    borderRadius: alias.cornerRadius.xs,
    overflow: "hidden",
});

export const main = style({
    flex: 1,
    padding: alias.spacing.m,
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
    flexShrink: 0,
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
    display: "block",
    width: 32,
    height: 32,
    borderRadius: "6px",
    overflow: "hidden",
});

export const rewardIntro = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    textAlign: "center",
});

export const productList = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
});

export const productCardSelected = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
    backgroundColor: vars.surface.muted,
    border: `1px solid ${vars.text.primary}`,
    borderRadius: alias.cornerRadius.l,
    textAlign: "left",
});

export const radio = style({
    flexShrink: 0,
    width: 20,
    height: 20,
    display: "grid",
    placeItems: "center",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.background,
    border: `2px solid ${vars.text.primary}`,
});

export const radioDot = style({
    width: 10,
    height: 10,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.text.primary,
});

export const productImage = style({
    flexShrink: 0,
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.s,
    overflow: "hidden",
    backgroundColor: vars.surface.elevated,
    border: `1px solid ${vars.border.subtle}`,
    boxShadow: "0px 2px 16px 0px #00000026",
});

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

export const stepCircle = style({
    flexShrink: 0,
});

export const stepConnector = style({
    position: "absolute",
    left: 14,
    top: 32,
    bottom: -16,
    width: 4,
    backgroundColor: vars.border.default,
});

export const stepConnectorDark = style([
    stepConnector,
    {
        background: `linear-gradient(to bottom, ${vars.text.primary} 50%, ${vars.border.default} 50%)`,
    },
]);

export const faqWrapper = style({
    paddingTop: alias.spacing.m,
    borderTop: `1px solid ${vars.border.subtle}`,
});

export const faqList = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    margin: 0,
    padding: 0,
    listStyle: "none",
});

export const faqItem = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
    paddingInline: alias.spacing.m,
    paddingBlock: alias.spacing.m,
    backgroundColor: vars.surface.muted,
    borderRadius: alias.cornerRadius.m,
    fontSize: fontSize.s,
    fontWeight: 600,
    lineHeight: 1.3,
});

export const faqIcon = style({
    flexShrink: 0,
    color: vars.icon.tertiary,
});

export const legalLinks = style({
    display: "flex",
    justifyContent: "center",
    gap: alias.spacing.m,
});

export const legalLink = style({
    color: vars.text.tertiary,
    fontSize: "11px",
});

export const footer = style({
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
    padding: `${alias.spacing.m} ${alias.spacing.l}`,
    paddingBottom: alias.spacing.l,
    backgroundColor: vars.surface.background,
    boxShadow: "2px 0px 8px 0px #00000029",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
});

/** The live page's black outlined CTAs, drawn as plain buttons rather than repainted `Button`s. */
const cta = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xs,
    height: 48,
    paddingInline: alias.spacing.l,
    borderRadius: alias.cornerRadius.full,
    fontFamily: "inherit",
    fontSize: fontSize.s,
    fontWeight: 600,
    lineHeight: "100%",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "transform 120ms ease",
    ":focus-visible": {
        outline: "none",
        boxShadow: `0 0 0 2px ${vars.surface.background}, 0 0 0 4px ${vars.border.focus}`,
    },
    selectors: {
        "&:active": { transform: "scale(0.98)" },
    },
});

export const shareButton = style([
    cta,
    {
        border: "none",
        backgroundColor: vars.text.primary,
        color: vars.text.onAction,
    },
]);

export const copyButton = style([
    cta,
    {
        border: `1.5px solid ${vars.text.primary}`,
        backgroundColor: vars.surface.background,
        color: vars.text.primary,
    },
]);
