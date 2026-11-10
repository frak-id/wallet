import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke } from "../../common/tauri";

export type NativeSharePayload = {
    url?: string;
    text?: string;
    title?: string;
    /** Preview thumbnail; only the frak-share plugin renders it. */
    imageUrl?: string;
};

export function canShareNatively(): boolean {
    return (
        IS_TAURI ||
        (typeof navigator !== "undefined" &&
            typeof navigator.share === "function")
    );
}

/**
 * Opens the OS share sheet: `true` once shared, `false` when dismissed or refused; rejects on a plugin failure only.
 * Inside Tauri it is always the frak-share plugin, even though WebKit exposes `navigator.share`:
 * WebKit presents from tao's window, which iOS 26 sizes for landscape and clips into the bottom-right corner.
 */
export async function shareNatively(
    payload: NativeSharePayload
): Promise<boolean> {
    if (IS_TAURI) {
        const invoke = await getInvoke();
        const response = await invoke<{ shared: boolean }>(
            "plugin:frak-share|share_text",
            payload
        );
        return response?.shared ?? true;
    }

    const { imageUrl: _, ...data } = payload;
    if (navigator.canShare && !navigator.canShare(data)) return false;
    try {
        // biome-ignore lint/plugin: the one sanctioned web share call
        await navigator.share(data);
        return true;
    } catch {
        return false;
    }
}
