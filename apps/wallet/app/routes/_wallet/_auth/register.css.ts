import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Push the success toast below `AppShell`'s `mainContent` paddingTop so it
 * doesn't hug the safe-area edge. Other consumers (e.g. `ReferralPageShell`
 * in `/profile/referral/share`) already inherit a 16px offset from the
 * normal-flow parent stack; the onboarding route renders the toast as a
 * direct sibling of step content, so we apply the same offset here.
 */
export const toastOffset = style({
    top: alias.spacing.m,
});
