---
"@frak-labs/components": patch
---

Fix every web component silently rendering nothing when loaded via the CDN bundle.

`sideEffects: false` in the package manifest was a lie: each `src/components/*/index.ts` exists *only* for its `registerWebComponent()` call, and `loader.ts` imports those modules purely for that side effect. Rolldown took the manifest at its word and dropped the call from all five `cdn/*` component chunks, so `customElements.define` never ran. The elements stayed `:not(:defined)`, which the loader's own FOUCE rule hides with `display: none !important` — so the components were absent rather than visibly broken.

Scope: the CDN bundle only, which is the documented merchant integration path (`cdn/loader.js`). The NPM `dist/` output was never affected — each component is its own Rolldown entrypoint there, and an entrypoint's side effects are never shaken — which is why `example/vanilla-js` (importing `dist/*.js` directly) kept working throughout.

`sideEffects` is now an allowlist. The `**/components/*/index.ts`, `**/bootstrap/loader.ts` and `**/components.ts` entries are what fix this build; the `./dist/*.js` entries protect *downstream* bundlers, which resolve `@frak-labs/components/buttonShare` to `./dist/buttonShare.js` and match `sideEffects` against that path — they were never needed for our own output.

A `writeBundle` guard (`assertComponentRegistrations` in `tsdown.config.ts`) now fails the build when a component's registration is missing from the emitted chunks, so this cannot regress silently. No unit test can cover it: the suite runs against `src`, where the side effect is always intact.
