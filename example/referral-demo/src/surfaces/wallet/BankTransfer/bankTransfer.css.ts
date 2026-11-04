import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

export const screen = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
});

export const cardsStack = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const switcherIcon = style({
    position: "absolute",
    zIndex: 1,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
});

export const switcherDisc = style({
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.background2,
    color: vars.icon.secondary,
});

export const amountSection = style({
    paddingTop: 26,
});

export const amountValue = style({
    display: "flex",
    alignItems: "center",
    color: vars.text.primary,
    fontSize: fontSize["5xl"],
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
});

const blink = keyframes({
    "0%, 50%": { opacity: 1 },
    "50.01%, 100%": { opacity: 0 },
});

/** The focused amount input's caret, as the real screen autofocuses it. */
export const caret = style({
    width: 2,
    height: "0.9em",
    marginLeft: 2,
    borderRadius: 1,
    background: vars.text.action,
    animation: `${blink} 1.1s step-end infinite`,
});

export const recapRow = style({
    width: "100%",
    minHeight: 49,
    paddingBlock: alias.spacing.s,
    paddingInline: alias.spacing.m,
});

export const beneficiaryIcon = style({
    display: "flex",
    color: vars.icon.primary,
});

export const grow = style({
    flexGrow: 1,
});

export const sent = style({
    paddingTop: alias.spacing.m,
    textAlign: "center",
});

export const sentIcon = style({
    display: "flex",
    color: vars.icon.action,
});
