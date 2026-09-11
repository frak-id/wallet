/**
 * Build-time stub for every `@tauri-apps/*` and `tauri-plugin-*` package,
 * wired through `resolve.alias` in the consumer's `vite.config.ts`.
 *
 * `IS_TAURI = false` already kills every call site, but Rolldown plans the
 * dynamic-import chunk graph before constant folding, so without this alias
 * the Tauri runtime still lands in the shared chunk. Every binding below
 * exists only so the bundler can resolve a symbol; none ever executes.
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

// `tauri-plugin-safe-area-insets`
export const getInsets = tauriUnavailable;
