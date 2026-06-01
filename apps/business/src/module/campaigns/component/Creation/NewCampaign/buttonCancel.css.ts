import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Confirm modal layout. */
export const content = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    padding: alias.spacing.l,
    textAlign: "center",
    // The app AlertDialog + DS content set width/maxWidth/background on a
    // single class with equal specificity, so plain props lose to stylesheet
    // order. `&&` (this element, doubled) bumps specificity to win — scoped to
    // this class, no global selector.
    selectors: {
        "&&": {
            width: "min(448px, calc(100vw - 32px))",
            maxWidth: "448px",
            backgroundColor: vars.surface.background2,
            borderRadius: alias.cornerRadius.xl,
        },
    },
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
    // content gap (xs=8) + this (m=16) ≈ the 24px desc→buttons spacing.
    paddingTop: alias.spacing.m,
    width: "100%",
});

/** Applied to each footer button so they split the row evenly. */
export const footerButton = style({
    flex: 1,
});
