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
