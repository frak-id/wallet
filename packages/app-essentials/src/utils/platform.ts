/**
 * Platform detection utilities for runtime environment checks
 */

/**
 * Check if the app is running in Tauri (native desktop/mobile app)
 *
 * @returns {boolean} True if running in Tauri, false otherwise
 *
 * @example
 * ```typescript
 * import { isTauri } from '@frak-labs/app-essentials';
 *
 * if (isTauri()) {
 *   // Native app specific logic
 *   console.log('Running in native app');
 * } else {
 *   // Web specific logic
 *   console.log('Running in browser');
 * }
 * ```
 */
export function isTauri(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.location.hostname === "tauri.localhost" ||
        window.location.protocol === "tauri:" ||
        "__TAURI__" in window ||
        "__TAURI_INTERNALS__" in window
    );
}

/**
 * Check if the app is running on iOS (Tauri iOS app)
 *
 * @returns {boolean} True if running on iOS, false otherwise
 *
 * @example
 * ```typescript
 * import { isIOS } from '@frak-labs/app-essentials';
 *
 * if (isIOS()) {
 *   // iOS-specific logic
 *   console.log('Running on iOS');
 * }
 * ```
 */
export function isIOS(): boolean {
    if (!isTauri()) return false;
    if (typeof window === "undefined") return false;
    return window.location.protocol === "tauri:";
}

/**
 * Check if the app is running on Android (Tauri Android app)
 *
 * @returns {boolean} True if running on Android, false otherwise
 *
 * @example
 * ```typescript
 * import { isAndroid } from '@frak-labs/app-essentials';
 *
 * if (isAndroid()) {
 *   // Android-specific logic
 *   console.log('Running on Android');
 * }
 * ```
 */
export function isAndroid(): boolean {
    if (!isTauri()) return false;
    if (typeof window === "undefined") return false;
    return window.location.hostname === "tauri.localhost";
}
