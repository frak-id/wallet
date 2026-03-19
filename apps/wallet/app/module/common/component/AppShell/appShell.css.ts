import { tablet } from "@frak-labs/design-system/breakpoints";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const safeTop = "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";
const safeBottom =
    "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))";

/**
 * Outer shell — fills the viewport, flex column so main + bottom bar stack.
 * Mobile: 100% width. Desktop: 393px max width (centered by parent body flex).
 */
export const shellContainer = style({
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    width: "100%",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            maxWidth: "393px",
        },
    },
});

/**
 * Main content area — no header anymore, only accounts for nav (47px) when present + safe areas.
 * Default: navigation visible.
 * Nav is in-flow (not fixed), so height calc handles sizing and flex
 * layout pushes the bar to the bottom.
 */
export const mainContent = style({
    padding: `${alias.spacing.m}`,
    height: `calc(100dvh - 60px - ${safeTop} - ${safeBottom})`,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            height: "758px",
        },
    },
});

/**
 * Variant: no nav — full height minus safe areas only.
 */
export const mainNoNav = style({
    height: `calc(100dvh - ${safeTop} - ${safeBottom})`,
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            height: "805px",
        },
    },
});

/**
 * Compound override: no header AND no nav (same as mainNoNav now, kept for compatibility).
 */
export const mainNoHeaderNoNav = style({
    height: `calc(100dvh - ${safeTop} - ${safeBottom})`,
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            height: "805px",
        },
    },
});

/**
 * Bottom tab bar — in normal flow, pushed to bottom by flex layout.
 */
export const bottomBar = style({
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
});
