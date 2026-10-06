import { tablet } from "@frak-labs/design-system/breakpoints";
import { vars } from "@frak-labs/design-system/theme";
import { alias, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { bottomBarHeight } from "@/module/common/component/BottomTabBar/bottomTabBar.css";
import { container as pageLayoutContainer } from "@/module/common/component/PageLayout/index.css";
import { scrollEdgeBlur } from "@/module/common/component/ScrollEdgeBlur/index.css";
import { NATIVE_TAB_BAR_HEIGHT_VAR } from "@/module/native-glass/constants";

/** Where page content starts at rest: below the status bar plus the page gap. */
export const shellContentTop = `calc(${safeArea.top} + ${alias.spacing.m})`;

// Reserve the bottom inset once (nav bar / home indicator); `max` keeps a 16px
// breather on web without double-counting the inset on Android.
const shellContentBottom = `max(${alias.spacing.m}, ${safeArea.bottom})`;

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
    overflow: "hidden",
    width: "100%",
    // The page canvas, which both edge scrims inherit.
    background: vars.surface.background2,
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            width: "393px",
            height: "min(var(--viewport-height, 100dvh), 852px)",
        },
    },
    selectors: {
        // A white page renders `PageLayout`; the scrims follow it.
        [`&:has(${pageLayoutContainer})`]: {
            background: vars.surface.background,
        },
        // Native app: opt out of the tablet phone-frame and fill the whole device.
        ':root[data-platform="tauri"] &': {
            width: "100%",
            height: "var(--viewport-height, 100dvh)",
            minHeight: "var(--viewport-height, 100dvh)",
        },
    },
});

/** A layout whose pages are all white stays white before a page mounts. */
export const shellContainerPage = style([
    shellContainer,
    { background: vars.surface.background },
]);

/**
 * The shell's only scroller. It spans the shell from the screen top and pads
 * below the status bar, so content rests clear of it and scrolls beneath it;
 * the variants reserve the bottom inset.
 */
const mainContentBase = style({
    paddingTop: shellContentTop,
    paddingInline: alias.spacing.m,
    // Focus-scrolled fields land below the status bar, not under it.
    scrollPaddingTop: shellContentTop,
    flex: "1 1 0",
    minHeight: 0,
    overflowY: "auto",
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
        // Bar overlays content on all breakpoints. Derived from the bar's own
        // metrics (reported by UIKit for the native one); a literal drifts.
        paddingBottom: `var(${NATIVE_TAB_BAR_HEIGHT_VAR}, calc(${bottomBarHeight} + ${safeArea.bottom}))`,
    },
]);

/** Main content without the tab bar (auth, SSO and full-screen pages). */
export const mainContentNoNav = style([
    mainContentBase,
    { paddingBottom: shellContentBottom },
]);

/**
 * Bottom tab bar — absolute inside shellContainer, so it stays in the shell
 * bounds without transform centering, which would break backdrop-filter.
 * Never give this a stacking context (`view-transition-name`, `isolation`):
 * it isolates the bar from the page it samples, killing the frosted glass.
 */
export const bottomBar = style({
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
});

/** Toasts anchored to the shell (not `main`) clear the status bar. */
export const shellToastTop = style({
    top: shellContentTop,
});

// Above scrolling content, below the tab bar and sticky page headers.
const edgeScrim = style({
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 5,
    pointerEvents: "none",
    background: "inherit",
});

/**
 * Covers the status bar in the page colour: solid behind the clock, fading out
 * down to resting content, so scrolled content dissolves under the bar. A page
 * drawing its own `ScrollEdgeBlur` replaces it.
 */
export const statusBarScrim = style([
    edgeScrim,
    {
        top: 0,
        height: shellContentTop,
        maskImage: "linear-gradient(to bottom, #000 50%, transparent)",
        selectors: {
            [`${shellContainer}:has(${scrollEdgeBlur}) &`]: {
                display: "none",
            },
        },
    },
]);

/** Covers the home indicator / Android nav bar in the page colour. */
export const navBarScrim = style([
    edgeScrim,
    { bottom: 0, height: shellContentBottom },
]);
