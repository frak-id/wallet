import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";
import { pressable } from "../page.css";

/* Mirrors `sdk/components/src/components/PostPurchase/PostPurchase.css.ts`. */

export const card = style({
    position: "relative",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.background,
    border: `1px solid ${vars.border.default}`,
});

const successGlow = keyframes({
    "0%": { boxShadow: "0 0 0 0 rgba(9, 190, 103, 0)" },
    "35%": {
        boxShadow: "0 0 0 4px rgba(9, 190, 103, 0.22)",
        borderColor: "#09be67",
    },
    "100%": { boxShadow: "0 0 0 0 rgba(9, 190, 103, 0)" },
});

export const highlighted = style({
    animation: `${successGlow} 1.6s ease-out 0.5s both`,
});

export const cardLayout = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: alias.spacing.xl,
});

export const cardLeft = style({
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

export const cardRight = style({
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: alias.spacing.xs,
    textAlign: "right",
});

export const badge = style({
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF534",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: "12px",
    color: vars.text.primary,
});

export const message = style({
    margin: 0,
    fontSize: "16px",
    lineHeight: "22px",
    color: vars.text.primary,
    fontWeight: 600,
});

export const cta = style([
    pressable,
    {
        margin: 0,
        border: 0,
        appearance: "none",
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: alias.spacing.xxs,
        padding: `${alias.spacing.s} ${alias.spacing.m}`,
        borderRadius: alias.cornerRadius.full,
        backgroundColor: vars.text.primary,
        color: vars.text.onAction,
        fontSize: "12px",
        fontWeight: "bold",
        textTransform: "uppercase",
    },
]);

export const ctaIcon = style({ margin: "-2px 0", flexShrink: 0 });

export const giftIcon = style({ display: "block", flexShrink: 0 });

export const frakLogo = style({
    display: "block",
    marginLeft: "auto",
    color: vars.text.primary,
});
