/**
 * Shared base CSS for SDK Light DOM components: reset rules, theme tokens and
 * SDK-local composables, injected once per page by `loader.ts` and
 * `useLightDomStyles`. `vanillaExtractInlinePlugin` treats this file as the
 * only entry allowed to emit reset/theme output — duplicating it across
 * component `<style>` tags breaks cascade order. Sprinkles stays out on purpose
 * (~24KB of utility classes merchant pages never use).
 */
import "@frak-labs/design-system/utils";
import "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

/**
 * SDK-local button reset shared by every component CTA. Inlined rather than
 * composed from `@frak-labs/design-system/utils` per component, so the rules
 * ship once via the global `<style>`. Keep it minimal: per-button styles live
 * in each component's own `.css.ts`.
 */
export const buttonReset = style({
    margin: 0,
    border: 0,
    appearance: "none",
    backgroundColor: "transparent",
    boxSizing: "border-box",
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
    cursor: "pointer",
    outline: "2px solid transparent",
    outlineOffset: "2px",

    selectors: {
        "&:focus-visible": {
            outlineColor: "currentColor",
        },
    },
});

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
