import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { recordError } from "@frak-labs/wallet-shared";

/**
 * Cross-platform haptic feedback.
 *
 * On the Tauri mobile shell we use the native haptics engine
 * (`@tauri-apps/plugin-haptics`), which drives the Taptic Engine on iOS and
 * the vibrator on Android — more reliable than raw duration-based vibration.
 * On the web (regular browser / PWA) we fall back to `navigator.vibrate`,
 * which is supported on Android Chrome but is a no-op on iOS Safari.
 *
 * The module import is lazy and gated on `IS_TAURI` so the `@tauri-apps`
 * dependency is tree-shaken out of the web bundle.
 */

let hapticsModulePromise: Promise<
    typeof import("@tauri-apps/plugin-haptics") | null
> | null = null;

function getHapticsModule() {
    if (!IS_TAURI) return Promise.resolve(null);

    if (!hapticsModulePromise) {
        hapticsModulePromise = import("@tauri-apps/plugin-haptics").catch(
            (error) => {
                recordError(error, { source: "haptics" });
                return null;
            }
        );
    }

    return hapticsModulePromise;
}

/**
 * Fire a short "notification" haptic, e.g. when a new signature request
 * arrives from a paired device. Best-effort: never throws.
 *
 * @param webFallbackMs - Vibration duration used on the web fallback path.
 */
export async function notifyHaptic(webFallbackMs = 50): Promise<void> {
    const module = await getHapticsModule();

    if (!module) {
        // Web fallback — Android Chrome only, silently ignored elsewhere.
        if (typeof navigator !== "undefined") {
            navigator.vibrate?.(webFallbackMs);
        }
        return;
    }

    try {
        await module.notificationFeedback("warning");
    } catch (error) {
        recordError(error, { source: "haptics" });
    }
}
