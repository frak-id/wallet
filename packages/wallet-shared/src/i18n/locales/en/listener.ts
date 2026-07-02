// Lite English locale barrel for the listener app.
//
// The listener only renders SDK modals, the embedded wallet, and the sharing
// page — it never needs the wallet-only `translation` bundle (~58 KB). This
// barrel re-exports just the two bundles the listener registers on i18next
// (`common` + `customized`), so `translation.json` stays out of the
// listener's module graph entirely. See `apps/listener/app/i18nPreload.ts`.

export { default as common } from "./common.json";
export { default as customized } from "./customized.json";
