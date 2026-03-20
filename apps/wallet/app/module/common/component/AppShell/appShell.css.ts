import { tablet } from "@frak-labs/design-system/breakpoints";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const safeTop = "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";
const safeBottom =
    "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))";

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
            height: "100dvh",
        },
    },
});

/**
 * Main content area — scrollable.
 * Mobile: bottom padding clears the fixed nav.
 * Tablet+: nav is in-flow, flex handles spacing.
 */
export const mainContent = style({
    padding: alias.spacing.m,
    paddingBottom: `calc(130px + env(safe-area-inset-bottom, 0px))`,
    flex: "1 1 0",
    minHeight: 0,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            paddingBottom: alias.spacing.m,
            maxHeight: "758px",
        },
    },
});

/**
 * Variant: no nav — only safe-area padding at the bottom.
 */
export const mainNoNav = style({
    paddingBottom: `calc(${alias.spacing.m} + ${safeBottom})`,
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            maxHeight: "805px",
        },
    },
});

/**
 * Compound override: no header AND no nav (same as mainNoNav now, kept for compatibility).
 */
export const mainNoHeaderNoNav = style({
    paddingBottom: `calc(${alias.spacing.m} + ${safeBottom})`,
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            maxHeight: "805px",
        },
    },
});

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
