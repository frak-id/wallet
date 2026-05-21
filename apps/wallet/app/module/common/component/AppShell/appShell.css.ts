import { tablet } from "@frak-labs/design-system/breakpoints";
import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const safeTop = "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";

/**
 * Outer shell — fills the viewport, flex column so main + bottom bar stack.
 * Mobile: 100% width. Desktop browser: 393px width (centered by parent body flex).
 * Tauri (iOS/iPad/Android): always 100% width / full viewport — the phone-frame
 * tablet preview only makes sense in a desktop browser. The native app must fill
 * the device screen on all sizes (App Store guideline 4 — iPad layout).
 */
export const shellContainer = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    // `--viewport-height` is mirrored from `window.visualViewport.height` by
    // `initKeyboardInset` on Tauri so the shell shrinks when the soft keyboard
    // opens (WKWebView and edge-to-edge Android WebView do not honor `dvh` or
    // `adjustResize`). Falls back to `100dvh` everywhere else.
    height: "var(--viewport-height, 100dvh)",
    paddingTop: safeTop,
    overflow: "hidden",
    width: "100%",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            width: "393px",
            minHeight: "unset",
            height: "min(var(--viewport-height, 100dvh), 852px)",
        },
    },
    selectors: {
        // Native app: opt out of the tablet phone-frame and fill the whole device.
        ':root[data-platform="tauri"] &': {
            width: "100%",
            height: "var(--viewport-height, 100dvh)",
            minHeight: "var(--viewport-height, 100dvh)",
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
    // Suppress iOS rubber-band and Android native PTR so PullToRefresh's preventDefault works.
    overscrollBehaviorY: "contain",
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
        // Reserve the home-indicator safe area so PageLayout's footer is not
        // clipped by the iOS gesture bar on auth/onboarding screens.
        paddingBottom: `calc(${alias.spacing.m} + env(safe-area-inset-bottom, 0px))`,
        "@media": {
            [`(min-width: ${tablet}px)`]: {
                maxHeight: "758px",
            },
        },
        selectors: {
            // Native app: drop the desktop-only height cap so content can use the
            // full device viewport on iPad.
            ':root[data-platform="tauri"] &': {
                maxHeight: "none",
            },
        },
    },
]);

/**
 * Bottom tab bar — overlays content on all breakpoints.
 * Positioned absolute inside shellContainer so it stays within the
 * shell bounds on tablet (393px in browser, full width in Tauri) without
 * needing transform centering, which would break backdrop-filter compositing.
 */
export const bottomBar = style({
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
});
