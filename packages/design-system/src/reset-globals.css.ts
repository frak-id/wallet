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
