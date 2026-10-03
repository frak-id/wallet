import { IS_IOS } from "@frak-labs/app-essentials/utils/platform";
import { recordError } from "@frak-labs/wallet-shared";
import {
    addPluginListener,
    invoke,
    type PluginListener,
} from "@tauri-apps/api/core";
import { NATIVE_TAB_BAR_HEIGHT_VAR } from "./constants";

const PLUGIN = "frak-tab-bar";

export type NativeTabItem = {
    key: string;
    title: string;
    /** Asset-catalog image in the iOS app bundle, or an SF Symbol name. */
    icon: string;
};

type NativeTabBarState = {
    items: NativeTabItem[];
    selectedKey: string | null;
    visible: boolean;
    tint?: string;
};

let supported = false;

let desired: NativeTabBarState = {
    items: [],
    selectedKey: null,
    visible: false,
};
let flushQueued = false;

/** Probed before first render, so the shell never mounts the wrong bar and swaps it. */
export async function initNativeTabBar() {
    if (!IS_IOS) return;
    try {
        const result = await invoke<{ supported: boolean }>(
            `plugin:${PLUGIN}|is_supported`
        );
        supported = result.supported;
    } catch (error) {
        recordError(error, { source: "native_tab_bar" });
    }
}

export function hasNativeTabBar(): boolean {
    return IS_IOS && supported;
}

/**
 * Merges `patch` into the desired bar state and sends the whole state once per
 * microtask, so an unmount/mount pair in one commit reaches native as its net result.
 */
export function syncNativeTabBar(patch: Partial<NativeTabBarState>) {
    desired = { ...desired, ...patch };
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flush);
}

async function flush() {
    flushQueued = false;
    try {
        const { height } = await invoke<{ height: number }>(
            `plugin:${PLUGIN}|update`,
            desired
        );
        document.documentElement.style.setProperty(
            NATIVE_TAB_BAR_HEIGHT_VAR,
            `${height}px`
        );
    } catch (error) {
        recordError(error, { source: "native_tab_bar" });
    }
}

export function onNativeTabSelected(
    handler: (event: { key: string }) => void
): Promise<PluginListener> {
    return addPluginListener(PLUGIN, "tabSelected", handler);
}
