import { isAndroid } from "@frak-labs/app-essentials/utils/platform";

/**
 * Initialize safe area insets for Android/Tauri using native plugin
 * Only runs on Android - iOS has native env() support
 */
export async function initSafeAreaInsets() {
    if (typeof window === "undefined") return;

    // Only run on Android - iOS has native env() support
    if (!isAndroid()) {
        console.log("Safe area insets: skipping (not Android)");
        return;
    }

    try {
        // Dynamic import to avoid loading on non-Tauri environments
        const { getInsets } = await import("tauri-plugin-safe-area-insets");
        const insets = (await getInsets()) as {
            top: number;
            bottom: number;
            left: number;
            right: number;
        };

        console.log("Native safe area insets received:", insets);

        // Set CSS variables from native insets
        document.documentElement.style.setProperty(
            "--safe-area-inset-top",
            `${insets.top}px`
        );
        document.documentElement.style.setProperty(
            "--safe-area-inset-bottom",
            `${insets.bottom}px`
        );
        document.documentElement.style.setProperty(
            "--safe-area-inset-left",
            `${insets.left}px`
        );
        document.documentElement.style.setProperty(
            "--safe-area-inset-right",
            `${insets.right}px`
        );

        console.log("Safe area CSS variables set successfully");
    } catch (error) {
        console.error("Failed to get safe area insets:", error);
    }
}
