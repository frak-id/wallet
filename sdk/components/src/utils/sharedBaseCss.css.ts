/**
 * Shared base CSS for SDK Light DOM components.
 *
 * Aggregates the design-system rules every Light DOM component depends on:
 * - Vanilla-extract reset rules (`base`, `element.button`, `fieldAppearance`,
 *   `focusRing`, ...) auto-applied by Box and composed in component styles.
 * - Theme tokens (`:root { --text-primary: ...; ... }`,
 *   `[data-theme='dark'] { ... }`).
 * - Sprinkles utility classes used by Box / responsive props.
 *
 * Injected ONCE per page by `loader.ts` (CDN) and by `useLightDomStyles`
 * when a component opts into vanilla-extract styling (NPM consumers). The
 * build plugin (`vanillaExtractInlinePlugin` in `tsdown.config.ts`) treats
 * this file as a special "shared base" entry: only its compiled `cssSource`
 * includes reset/theme/sprinkles output. Every other component `.css.ts`
 * file excludes them so we don't ship ~28KB of duplicated CSS per
 * component and don't have to dedupe rules across multiple `<style>` tags
 * at runtime — the previous approach silently failed when components
 * mounted in certain orders, leaving `.reset_fieldAppearance`'s
 * `background-color: transparent` overriding component CTAs.
 */
import "@frak-labs/design-system/utils";
import "@frak-labs/design-system/theme";
import "@frak-labs/design-system/sprinkles";

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
