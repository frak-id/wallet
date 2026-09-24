import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

/** Tauri's clipboard plugin in the app, `navigator.clipboard` on the web. Rejects when denied. */
export async function readClipboardText(): Promise<string> {
    if (IS_TAURI) {
        const { readText } = await import(
            "@tauri-apps/plugin-clipboard-manager"
        );
        return readText();
    }
    return navigator.clipboard.readText();
}
