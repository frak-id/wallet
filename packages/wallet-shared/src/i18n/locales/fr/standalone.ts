// Locale subset for the standalone `/sharing` + `/install` entrypoints.
//
// Those pages read a fixed set of key trees: `customized.sdk.sharingPage.*`,
// `common.sharing.*` and `translation.installCode.*`. Importing them by NAME
// (rather than the whole JSON default export) lets the bundler drop the other
// ~45 KB of `translation.json`, which is the single biggest string payload in
// the wallet. It only works because the standalone Vite config disables
// `json.stringify` — see `apps/wallet/vite.standalone.config.ts`.
//
// See `../en/standalone.ts` for the lazy-loaded English twin.

import { common as commonKeys, error, sharing } from "./common.json";
import { sdk } from "./customized.json";
import { installCode } from "./translation.json";

export const translation = { installCode };
export const common = { common: commonKeys, error, sharing };
export const customized = { sdk };
