import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke } from "../tauri";

/**
 * Open a URL using the native handler on Tauri (system browser, mail app, etc.)
 * or `window.open` on the web. Required because the Tauri webview ignores
 * `mailto:`/`tel:` schemes and `target="_blank"` does not spawn a new window.
 *
 * Routes through the centralized `getInvoke()` bridge so the dynamic import of
 * `@tauri-apps/api/core` is memoized across every plugin call site, and so the
 * `IS_TAURI` short-circuit lets Rolldown DCE the Tauri branch out of web bundles.
 */
export async function openExternalUrl(url: string): Promise<void> {
    if (IS_TAURI) {
        const invoke = await getInvoke();
        await invoke("plugin:opener|open_url", { url });
        return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
}
