import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

/** Confirm modal layout to match Figma (Dashboard 338:55433). */
export const content = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    padding: alias.spacing.l,
    textAlign: "center",
});

// The app AlertDialog + DS content both set width/maxWidth/background on a
// single class with the same specificity, so plain props lose to stylesheet
// order. Doubling our own selector (`.content.content`) bumps specificity so
// these win deterministically — no `!important`.
globalStyle(`${content}${content}`, {
    width: "min(448px, calc(100vw - 32px))",
    maxWidth: "448px",
    backgroundColor: vars.surface.background2,
    borderRadius: alias.cornerRadius.xl,
});

export const title = style({
    textAlign: "center",
    width: "100%",
});

/** Blue exclamation inside the light-blue IconCircle badge. */
export const badgeIcon = style({
    color: vars.text.action,
});

/** Two equal-width buttons side by side. */
export const footer = style({
    display: "flex",
    gap: alias.spacing.m,
    // content gap (xs=8) + this (m=16) ≈ Figma's 24px desc→buttons spacing.
    paddingTop: alias.spacing.m,
    width: "100%",
});

// Equal-width buttons (`selectors` can't target children; globalStyle can).
globalStyle(`${footer} > *`, {
    flex: 1,
});
