import { createGlobalTheme, createThemeContract } from "@vanilla-extract/css";

import { semanticLight } from "./tokens.css";

export const vars = createThemeContract({
    text: {
        primary: null,
        secondary: null,
        tertiary: null,
        disabled: null,
        action: null,
        actionHover: null,
        onAction: null,
        error: null,
        success: null,
        warning: null,
    },
    surface: {
        primary: null,
        secondary: null,
        background: null,
        background2: null,
        elevated: null,
        muted: null,
        tertiary: null,
        overlay: null,
        disabled: null,
        primaryHover: null,
        primaryPressed: null,
        secondaryHover: null,
        secondaryPressed: null,
        error: null,
        success: null,
        warning: null,
    },
    border: {
        subtle: null,
        focus: null,
        error: null,
        success: null,
        warning: null,
        default: null,
    },
    icon: {
        primary: null,
        secondary: null,
        tertiary: null,
        disabled: null,
        action: null,
        actionHover: null,
        onAction: null,
        error: null,
        success: null,
        warning: null,
    },
});

createGlobalTheme(":root", vars, semanticLight);

// Dark mode is planned, not shipped: nothing sets `data-theme`, so emitting
// the block would only add ~500 B gz to every merchant page. Re-enable with
// `createGlobalTheme("[data-theme='dark']", vars, semanticDark)` once a
// switch exists; `semanticDark` in tokens.css.ts stays the tested source.
