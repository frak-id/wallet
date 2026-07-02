// Barrel for the English locale bundle.
//
// Bundling the files behind a single module lets consumers replace multiple
// dynamic imports with one. The native ESM module loader would have deduped
// the fetches anyway since they originally compiled to the same bundler
// chunk, but the single-import form keeps source code clearer and trims one
// `__vitePreload` call per language switch.
//
// `common` holds the strings shared between the wallet app and the listener
// (error toasts, pairing, in-app-browser, sharing, mobile SSO/tx). The
// listener imports only `common` + `customized`, never the wallet-only
// `translation` bundle. See `apps/listener/app/i18nPreload.ts`.

export { default as common } from "./common.json";
export { default as customized } from "./customized.json";
export { default as translation } from "./translation.json";
