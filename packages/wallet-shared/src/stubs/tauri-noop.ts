/**
 * Build-time stub for every `@tauri-apps/*` and `tauri-plugin-*` package.
 *
 * In non-Tauri builds (web wallet, listener) every code path that reaches a
 * Tauri import is statically eliminated by Rolldown via the `IS_TAURI` /
 * `IS_IOS` / `IS_ANDROID` constants. Even so, intra-`@tauri-apps` static
 * imports keep the runtime (`invoke` / `transformCallback` /
 * `__TAURI_INTERNALS__`) alive in the shared chunk because Rolldown plans the
 * dynamic-import chunk graph before constant folding.
 *
 * Aliasing every Tauri runtime path to this module via `resolve.alias` in the
 * consumer's `vite.config.ts` short-circuits that: the bundler resolves Tauri
 * symbols against this empty implementation, so the real Tauri runtime never
 * enters the chunk graph in the first place.
 *
 * The named bindings below cover every symbol the wallet-shared and
 * (transitively) consumer code can destructure from a Tauri package — they
 * exist solely so the bundler resolves the symbols. None of them ever
 * execute at runtime: every call site is dead code under `IS_TAURI = false`.
 */

const tauriUnavailable = (): never => {
    throw new Error(
        "Tauri runtime is not available in this build. The current build target never runs inside Tauri; this stub should never be reached."
    );
};

// `@tauri-apps/api/core`
export const invoke = tauriUnavailable;
export const transformCallback = tauriUnavailable;
export const isTauri = (): boolean => false;
export class Channel {}
export class PluginListener {}
export class Resource {}
export const SERIALIZE_TO_IPC_FN = Symbol.for("__TAURI_TO_IPC_KEY__");
export const addPluginListener = tauriUnavailable;
export const checkPermissions = tauriUnavailable;
export const requestPermissions = tauriUnavailable;
export const convertFileSrc = tauriUnavailable;

// `@tauri-apps/api/app` (back-button on Android)
export const onBackButtonPress = tauriUnavailable;

// `@tauri-apps/api/path`
export const downloadDir = tauriUnavailable;
export const join = tauriUnavailable;

// `@tauri-apps/plugin-clipboard-manager`
export const readText = tauriUnavailable;
export const writeText = tauriUnavailable;

// `@tauri-apps/plugin-deep-link`
export const onOpenUrl = tauriUnavailable;
export const getCurrent = tauriUnavailable;

// `@tauri-apps/plugin-opener`
export const openUrl = tauriUnavailable;
export const openPath = tauriUnavailable;

// `@tauri-apps/plugin-biometric`
export const checkStatus = tauriUnavailable;
export const authenticate = tauriUnavailable;

// `@tauri-apps/plugin-fs`
export const writeTextFile = tauriUnavailable;
export const BaseDirectory = {} as never;

// `tauri-plugin-fcm` and co.
export const getToken = tauriUnavailable;
export const onTokenRefresh = tauriUnavailable;
export const register = tauriUnavailable;
export const deleteToken = tauriUnavailable;
export const createChannel = tauriUnavailable;

// `tauri-plugin-safe-area-insets`
export const getInsets = tauriUnavailable;
