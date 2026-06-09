import { tablet } from "@frak-labs/design-system/breakpoints";
import { vars } from "@frak-labs/design-system/theme";
import { alias, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

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
    paddingTop: safeArea.top,
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
        paddingBottom: `calc(110px + ${safeArea.bottom})`,
    },
]);

/**
 * Main content without nav clearance.
 * Used on auth/onboarding screens where the bottom bar is hidden.
 */
export const mainContentNoNav = style([
    mainContentBase,
    {
        // Reserve the bottom inset once (nav bar / home indicator); `max` keeps
        // a 16px breather on web without double-counting the inset on Android.
        paddingBottom: `max(${alias.spacing.m}, ${safeArea.bottom})`,
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

/**
 * Edge-to-edge draws content under the system bars (Android nav bar, iOS home
 * indicator), so scrolling content shows through in the bottom inset. Paint a
 * solid strip over it. Height matches `mainContentNoNav`'s reserved padding
 * (`max(spacing.m, safeArea.bottom)`) so it covers exactly the region content
 * scrolls behind: Android nav bar (~48px) / gesture (~16-24px), iOS notch
 * (~34px), iPhone SE / web (16px floor). Sits above scrolling content, below
 * the tab bar.
 */
export const navBarScrim = style({
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: `max(${alias.spacing.m}, ${safeArea.bottom})`,
    background: vars.surface.background,
    zIndex: 5,
    pointerEvents: "none",
});
