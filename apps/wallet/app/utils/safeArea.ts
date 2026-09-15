import { IS_ANDROID } from "@frak-labs/app-essentials/utils/platform";
import { recordError } from "@frak-labs/wallet-shared";

/**
 * Initialize safe area insets for Android/Tauri using the native plugin.
 * Android only — iOS has native `env()` support.
 */
export async function initSafeAreaInsets() {
    if (typeof window === "undefined") return;

    if (!IS_ANDROID) {
        return;
    }

    try {
        const { getInsets } = await import("tauri-plugin-safe-area-insets");
        const insets = (await getInsets()) as {
            top: number;
            bottom: number;
            left: number;
            right: number;
        };

        document.documentElement.style.setProperty(
            "--safe-area-inset-top",
            `${insets.top}px`
        );
        // Bottom inset collapses to 0 while the keyboard is open (it covers the
        // nav bar); `--keyboard-open` is owned by initKeyboardInset.
        document.documentElement.style.setProperty(
            "--nav-bar-inset",
            `${insets.bottom}px`
        );
        document.documentElement.style.setProperty(
            "--safe-area-inset-bottom",
            "calc(var(--nav-bar-inset, 0px) * (1 - var(--keyboard-open, 0)))"
        );
        document.documentElement.style.setProperty(
            "--safe-area-inset-left",
            `${insets.left}px`
        );
        document.documentElement.style.setProperty(
            "--safe-area-inset-right",
            `${insets.right}px`
        );
    } catch (error) {
        recordError(error, { source: "safe_area" });
    }
}
