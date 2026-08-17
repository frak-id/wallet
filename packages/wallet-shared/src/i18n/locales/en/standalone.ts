// English twin of `../fr/standalone.ts`, lazy-loaded by the standalone
// entrypoints once the language detector settles on `en`. See that file for
// why the imports are named rather than default.

import { common as commonKeys, error, sharing } from "./common.json";
import { sdk } from "./customized.json";
import {
    common as commonTree,
    installCode,
    pendingActions,
} from "./translation.json";

export const translation = { installCode, pendingActions, common: commonTree };
export const common = { common: commonKeys, error, sharing };
export const customized = { sdk };
