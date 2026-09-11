// Barrel for the English locale bundle.
//
// `common` holds the strings shared between the wallet app and the listener;
// the listener imports only `common` + `customized`, never the wallet-only
// `translation` bundle. See `apps/listener/app/i18nPreload.ts`.

export { default as common } from "./common.json";
export { default as customized } from "./customized.json";
export { default as translation } from "./translation.json";
