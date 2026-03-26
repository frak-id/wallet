import { tablet } from "@frak-labs/design-system/breakpoints";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const safeTop = "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";

/**
 * Outer shell — fills the viewport, flex column so main + bottom bar stack.
 * Mobile: 100% width. Desktop: 393px width (centered by parent body flex).
 */
export const shellContainer = style({
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    paddingTop: safeTop,
    width: "100%",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            width: "393px",
            minHeight: "unset",
            height: "min(100dvh, 852px)",
        },
    },
});

const mainContentBase = style({
    padding: alias.spacing.m,
    flex: "1 1 0",
    minHeight: 0,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
});

/**
 * Main content with bottom padding to clear the fixed nav bar.
 * Used when `navigation` is enabled.
 */
export const mainContentWithNav = style([
    mainContentBase,
    {
        paddingBottom: `calc(110px + env(safe-area-inset-bottom, 0px))`,
        "@media": {
            [`(min-width: ${tablet}px)`]: {
                // Nav is in-flow on tablet+, no extra clearance needed
                paddingBottom: alias.spacing.m,
                maxHeight: "758px",
            },
        },
    },
]);

/**
 * Main content without nav clearance.
 * Used on auth/onboarding screens where the bottom bar is hidden.
 */
export const mainContentNoNav = style([
    mainContentBase,
    {
        paddingBottom: alias.spacing.m,
        "@media": {
            [`(min-width: ${tablet}px)`]: {
                maxHeight: "758px",
            },
        },
    },
]);

/**
 * Bottom tab bar — fixed at viewport bottom on mobile, in-flow on tablet+.
 * Mobile: position fixed, always visible while scrolling.
 * Tablet+: normal flow at bottom of shell flex column.
 */
export const bottomBar = style({
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    zIndex: 10,
    padding: `0 ${alias.spacing.m}`,
    paddingBottom: `calc(${alias.spacing.s} + env(safe-area-inset-bottom, 0px))`,
    paddingTop: alias.spacing.s,
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            position: "static",
            transform: "none",
            width: "auto",
            left: "auto",
            zIndex: "auto",
        },
    },
});
