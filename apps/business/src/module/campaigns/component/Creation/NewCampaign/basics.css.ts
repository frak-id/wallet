import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/* ---- shared field chrome (title + merchant cards) ---- */

/** Card field label / hint sit inset by 16px, matching the Figma "Input". */
export const fieldLabel = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

export const fieldHint = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});

/**
 * Merchant Select trigger restyled to the Figma field: 56px tall, muted
 * (#f7f7f7) fill, no border, 12px radius. `&&` beats the DS trigger base
 * (equal-specificity stylesheet rule) without a global selector.
 */
export const selectTrigger = style({
    selectors: {
        "&&": {
            width: "100%",
            height: "56px",
            padding: `0 ${alias.spacing.m}`,
            backgroundColor: vars.surface.tertiary,
            border: "none",
            borderRadius: alias.cornerRadius.m,
            fontSize: "16px",
        },
    },
});

/* ---- reward currency ---- */

/** Vertical list of currency option rows (flush, like the goal list). */
export const cells = style({
    display: "flex",
    flexDirection: "column",
    width: "100%",
});

/** A currency option row: radio + main text (+ optional right slot). */
export const cellRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "flex-start",
    width: "100%",
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
    textAlign: "left",
});

/** Radio centred in a 40px band, nudged 2px down (Figma "Selector" + py-2). */
export const cellSelector = style({
    display: "flex",
    alignItems: "center",
    height: 40,
    flexShrink: 0,
    marginTop: 2,
});

export const cellMain = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    flex: 1,
    minWidth: 0,
});

/** "Recommended" status, top-aligned with the title. */
export const cellRight = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    flexShrink: 0,
    marginTop: 2,
});

/** Blue "Recommended" label text. */
export const actionText = style({
    color: vars.text.action,
});

/** 6px blue dot preceding the "Recommended" label. */
export const recommendedDot = style({
    width: 6,
    height: 6,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.text.action,
    flexShrink: 0,
});

/** White wrapper around the "Choose another" row + the token grid. */
export const expandWrap = style({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.background,
    overflow: "hidden",
});

/**
 * Token grid (GBP/EUR/USD/USDC) indented under the radio + gap (40 + 16).
 * `&&` overrides the DS RadioGroup base `flex-direction: column` (equal
 * specificity otherwise loses on stylesheet order).
 */
export const tokensRow = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "stretch",
    paddingLeft: 56,
    width: "100%",
    selectors: {
        "&&": {
            flexDirection: "row",
        },
    },
});

export const tokenCell = style({
    display: "flex",
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: alias.spacing.m,
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});

/** Currency icon + code sit together (8px gap). */
export const tokenLabel = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    minWidth: 0,
});
