import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Paints the whole Monerium `DetailSheet` with `surface.background2` so the
 * white elevated feature card stands out the way Figma shows it. Overrides
 * both the overlay's mobile background and the `DetailSheet` container's
 * desktop (`>=1024px`) `surface.background` rule.
 */
export const sheetSurface = style({
    backgroundColor: vars.surface.background2,
    "@media": {
        "screen and (min-width: 1024px)": {
            backgroundColor: vars.surface.background2,
        },
    },
});

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
 * Feature cell used inside the info/kyc card. Each cell stacks flush
 * (no gap between them) inside the surrounding card; the 12px vertical
 * padding provides the inter-row rhythm and 16px horizontal padding
 * matches the Figma spec.
 */
export const featureCell = style({
    display: "flex",
    alignItems: "flex-start",
    gap: alias.spacing.m,
    paddingInline: alias.spacing.m,
    paddingBlock: alias.spacing.s,
    width: "100%",
});

/**
 * Icon slot for a feature cell. No background bubble — the icon is
 * rendered directly (filled glyph in the primary icon color). The 2px
 * top/bottom inset matches Figma's `py-[2px]` on the Left column so
 * the icon optically aligns with the title row.
 */
export const featureIconSlot = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingBlock: "2px",
    color: vars.icon.primary,
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
