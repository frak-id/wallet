import { isTauri } from "@frak-labs/app-essentials/utils/platform";

/**
 * Open a URL using the native handler on Tauri (system browser, mail app, etc.)
 * or `window.open` on the web. Required because the Tauri webview ignores
 * `mailto:`/`tel:` schemes and `target="_blank"` does not spawn a new window.
 */
export async function openExternalUrl(url: string): Promise<void> {
    if (isTauri()) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
}
