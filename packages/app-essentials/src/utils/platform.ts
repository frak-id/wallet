/**
 * Platform detection utilities for runtime environment checks.
 *
 * Designed for build-time dead-code elimination. When the consuming bundler
 * applies `define` substitutions for `__IS_TAURI__`, `__IS_IOS__` and
 * `__IS_ANDROID__`, the exported constants collapse to literal booleans and
 * Rolldown's `inlineConst` propagates them to every call site, eliminating
 * dead branches and their transitive imports (e.g. `@tauri-apps/*`).
 *
 * When `define` is not applied (tests, sdk consumers, REPL), the constants
 * fall back to the historical runtime detection so behavior is preserved.
 *
 * Prefer the `IS_TAURI` / `IS_IOS` / `IS_ANDROID` constants over the function
 * aliases (`isTauri()` / `isIOS()` / `isAndroid()`) at hot paths — only the
 * constants are guaranteed to be inlined and tree-shaken by the bundler.
 */

declare const __IS_TAURI__: boolean;
declare const __IS_IOS__: boolean;
declare const __IS_ANDROID__: boolean;

function detectTauriRuntime(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.location.hostname === "tauri.localhost" ||
        window.location.protocol === "tauri:" ||
        "__TAURI__" in window ||
        "__TAURI_INTERNALS__" in window
    );
}

function detectIosRuntime(): boolean {
    if (typeof window === "undefined") return false;
    return window.location.protocol === "tauri:";
}

function detectAndroidRuntime(): boolean {
    if (typeof window === "undefined") return false;
    return window.location.hostname === "tauri.localhost";
}

/**
 * `true` when the bundle runs inside the Tauri shell (desktop or mobile).
 *
 * Build-time literal in apps that wire `__IS_TAURI__` through Vite `define`;
 * runtime-detected otherwise.
 */
export const IS_TAURI: boolean =
    typeof __IS_TAURI__ === "boolean" ? __IS_TAURI__ : detectTauriRuntime();

/**
 * `true` when the bundle runs inside the Tauri iOS shell.
 *
 * Falls back to runtime detection only when `__IS_IOS__` is not provided by
 * the bundler. Always implies `IS_TAURI`.
 */
export const IS_IOS: boolean =
    typeof __IS_IOS__ === "boolean"
        ? __IS_IOS__
        : IS_TAURI && detectIosRuntime();

/**
 * `true` when the bundle runs inside the Tauri Android shell.
 *
 * Falls back to runtime detection only when `__IS_ANDROID__` is not provided
 * by the bundler. Always implies `IS_TAURI`.
 */
export const IS_ANDROID: boolean =
    typeof __IS_ANDROID__ === "boolean"
        ? __IS_ANDROID__
        : IS_TAURI && detectAndroidRuntime();

/**
 * Backwards-compatible function alias for {@link IS_TAURI}.
 *
 * Prefer the constant at hot paths — function-call sites are not always
 * folded by the bundler and may keep the dead branch alive.
 */
export const isTauri = (): boolean => IS_TAURI;

/**
 * Backwards-compatible function alias for {@link IS_IOS}.
 */
export const isIOS = (): boolean => IS_IOS;

/**
 * Backwards-compatible function alias for {@link IS_ANDROID}.
 */
export const isAndroid = (): boolean => IS_ANDROID;
