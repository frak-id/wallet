import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Circular close button (top-left of each monerium screen).
 */
export const closeButton = style({
    width: "36px",
    height: "36px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: vars.icon.secondary,
    padding: 0,
});

/**
 * 40×40 icon circle for feature rows.
 */
export const featureIcon = style({
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.tertiary,
    flexShrink: 0,
});

/**
 * Large, centered, bare-bones amount input. Uses the native mobile numeric
 * keypad via `inputMode="decimal"`. No border, no background — the field blends
 * into the screen so the focus is on the value.
 */
export const amountInput = style({
    width: "100%",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: vars.text.primary,
    fontSize: "56px",
    lineHeight: "1",
    fontWeight: 700,
    textAlign: "center",
    padding: 0,
    fontFamily: "inherit",
    caretColor: vars.text.primary,
    "::placeholder": {
        color: vars.text.disabled,
    },
});

/**
 * Unstyled button that behaves like an inline text link (e.g. "Modifier",
 * "Annuler"). Relies on surrounding Text wrapping for color.
 */
export const linkButton = style({
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    textDecoration: "underline",
});

/**
 * Error variant of the wallet balance card — red tinted background + border.
 */
export const walletCardError = style({
    backgroundColor: vars.surface.error,
    border: `1px solid ${vars.border.error}`,
});

/**
 * Round 40×40 icon bubble used inside beneficiary / wallet cards.
 */
export const cardIconBubble = style({
    width: "40px",
    height: "40px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.tertiary,
    flexShrink: 0,
});

/**
 * Row inside the IBAN manager — selectable card row with radio affordance.
 */
export const ibanRow = style({
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
});
