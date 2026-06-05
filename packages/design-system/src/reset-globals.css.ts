import { globalStyle } from "@vanilla-extract/css";

/**
 * Global CSS reset for the wallet app.
 *
 * ⚠️ These rules target universal selectors (`*`, `html`, `ul`, etc.) and are
 * only safe to inject on pages the wallet app owns end-to-end. They must NOT
 * be pulled into SDK bundles (`sdk/components/*`) because those bundles ship
 * inside merchant pages, where resetting `*` would break merchant layouts.
 *
 * Import this file from `global.ts` only. For scoped resets usable anywhere
 * (including SDK components), see `reset.css.ts` which exports `base`,
 * `element` and `visuallyHidden` as standard vanilla-extract style classes.
 */

globalStyle("*, *::after, *::before", {
    margin: 0,
    boxSizing: "border-box",
});

/**
 * Seed the safe-area inset variables from `env()` so the `safeArea` design
 * tokens resolve them. WKWebView does not evaluate `env()` when it sits in a
 * `var()` fallback (`var(--x, env(...))` returns 0 on a notched iPhone), but
 * resolves it once the variable itself is assigned the `env()`. Android's native
 * plugin (initSafeAreaInsets) overrides top/bottom via inline style, which wins.
 */
globalStyle(":root", {
    vars: {
        "--safe-area-inset-top": "env(safe-area-inset-top, 0px)",
        "--safe-area-inset-right": "env(safe-area-inset-right, 0px)",
        "--safe-area-inset-bottom": "env(safe-area-inset-bottom, 0px)",
        "--safe-area-inset-left": "env(safe-area-inset-left, 0px)",
    },
});

globalStyle("html", {
    height: "100vh",
    scrollBehavior: "smooth",
});

/**
 * Native (Tauri) document lock.
 *
 * On WKWebView the soft keyboard does not resize the web view: when an input is
 * focused the keyboard overlays the bottom and WKWebView *scrolls its own scroll
 * view* up to keep the caret visible. With `html` left at full height (`100vh`)
 * while only the app shell shrinks to `--viewport-height` (mirrored from
 * `visualViewport` by `initKeyboardInset`), that scroll has somewhere to go and
 * the whole page jumps up on focus — `pinScroll` only yanks it back *after* the
 * jump, so it flashes.
 *
 * Pinning `html` to the visible height with `overflow: hidden` makes the
 * document non-scrollable (`scrollHeight === clientHeight`), so there is nothing
 * for WKWebView to scroll on focus. The app keeps its own scroller (AppShell's
 * `main`, `overflow: auto`), which still reveals inputs above the keyboard
 * because the shell itself shrinks via `--viewport-height`.
 *
 * `data-platform="tauri"` is set on `<html>` in index.html.
 */
globalStyle('html[data-platform="tauri"]', {
    height: "var(--viewport-height, 100dvh)",
    overflow: "hidden",
});

globalStyle("ul", {
    margin: 0,
    padding: 0,
    listStyle: "none",
});

globalStyle("sub, sup", {
    fontSize: "100%",
});

globalStyle("sup", {
    top: "-0.15em",
});
