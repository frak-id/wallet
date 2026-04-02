import { tablet } from "@frak-labs/design-system/breakpoints";
import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const safeTop = "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";

/**
 * Outer shell — fills the viewport, flex column so main + bottom bar stack.
 * Mobile: 100% width. Desktop: 393px width (centered by parent body flex).
 */
export const shellContainer = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    paddingTop: safeTop,
    overflow: "hidden",
    width: "100%",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            width: "393px",
            minHeight: "unset",
            height: "min(100dvh, 852px)",
        },
    },
});

export const shellContainerAuth = style([
    shellContainer,
    { background: vars.surface.background },
]);

const mainContentBase = style({
    padding: alias.spacing.m,
    flex: "1 1 0",
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
});

/**
 * Main content with bottom padding to clear the fixed nav bar.
 * Used when `navigation` is enabled.
 */
export const mainContentWithNav = style([
    mainContentBase,
    {
        // Bar is absolute-positioned on all breakpoints, so content
        // needs bottom padding everywhere to stay above it.
        paddingBottom: `calc(110px + env(safe-area-inset-bottom, 0px))`,
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
 * Bottom tab bar — overlays content on all breakpoints.
 * Positioned absolute inside shellContainer so it stays within the
 * shell bounds on tablet (393px) without needing transform centering,
 * which would break backdrop-filter compositing.
 */
export const bottomBar = style({
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
});
