/**
 * Shared base CSS for SDK Light DOM components.
 *
 * Aggregates the design-system rules every Light DOM component depends on:
 * - Vanilla-extract reset rules (`base`, `element.button`, `fieldAppearance`,
 *   `focusRing`, ...) composed in component styles like Banner's `referralCta`.
 * - Theme tokens (`:root { --text-primary: ...; ... }`,
 *   `[data-theme='dark'] { ... }`).
 * - SDK-local composable styles (e.g. `buttonReset`) that more than one
 *   component shares — kept here so the rules ship once in the global
 *   `<style>` instead of being duplicated in each component's cssSource.
 *
 * Injected ONCE per page by `loader.ts` (CDN) and by `useLightDomStyles`
 * when a component opts into vanilla-extract styling (NPM consumers). The
 * build plugin (`vanillaExtractInlinePlugin` in `tsdown.config.ts`) treats
 * this file as a special "shared base" entry: only its compiled `cssSource`
 * includes reset/theme output. Every other component `.css.ts` file
 * excludes them so we don't duplicate shared rules across multiple `<style>`
 * tags at runtime — the previous approach silently failed when components
 * mounted in certain orders, leaving `.reset_fieldAppearance`'s
 * `background-color: transparent` overriding component CTAs.
 *
 * Sprinkles is intentionally NOT imported here: SDK components write CSS
 * directly via `style({...})` instead of pulling design-system layout
 * primitives (Box/Stack/Columns) so we don't ship ~24KB of unused utility
 * classes to merchant pages.
 */
import "@frak-labs/design-system/utils";
import "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

/**
 * SDK-local button reset shared by every component CTA.
 *
 * Inlined here — instead of composing `element.button` from
 * `@frak-labs/design-system/utils` per-component — so the rules ship once
 * via the global `<style>` injection and component cssSource stays lean.
 * Keep this minimal: only the resets every Frak SDK button needs.
 * Per-button styles (background, font-size, padding, …) live in each
 * component's own `.css.ts`.
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
