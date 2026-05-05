import { isAndroid, isIOS } from "@frak-labs/app-essentials/utils/platform";

export type NativeUpdateStatus =
    | { status: "up_to_date"; currentVersion: string }
    | {
          status: "available";
          currentVersion: string;
          storeVersion: string;
      }
    | {
          status: "in_progress";
          currentVersion: string;
          bytesDownloaded: number;
          totalBytes: number;
      }
    | { status: "downloaded"; currentVersion: string }
    | { status: "unsupported"; currentVersion: string };

type StartSoftUpdateResponse = { started: boolean };
type CompleteSoftUpdateResponse = { completed: boolean };
type OpenStoreResponse = { opened: boolean };

/**
 * Thin wrappers around the `frak-updater` Tauri plugin. Kept as standalone
 * functions (not hooks) so they can be invoked from query/mutation
 * callbacks without re-renders.
 *
 * Each call dynamically imports `@tauri-apps/api/core` so the wallet's web
 * build never pulls in the Tauri runtime — the platform guards short-circuit
 * to `unsupported` outside iOS/Android.
 */
export async function checkNativeUpdate(): Promise<NativeUpdateStatus> {
    if (!isIOS() && !isAndroid()) {
        return { status: "unsupported", currentVersion: "" };
    }
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<NativeUpdateStatus>("plugin:frak-updater|check_update");
}

export async function startNativeSoftUpdate(): Promise<boolean> {
    if (!isIOS() && !isAndroid()) return false;
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<StartSoftUpdateResponse>(
        "plugin:frak-updater|start_soft_update"
    );
    return response.started;
}

/**
 * Android-only finalisation step for FLEXIBLE updates. Resolves to `false`
 * on iOS or when nothing is pending — safe to call unconditionally.
 */
export async function completeNativeSoftUpdate(): Promise<boolean> {
    if (!isAndroid()) return false;
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<CompleteSoftUpdateResponse>(
        "plugin:frak-updater|complete_soft_update"
    );
    return response.completed;
}

export async function openNativeStore(): Promise<boolean> {
    if (!isIOS() && !isAndroid()) return false;
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<OpenStoreResponse>(
        "plugin:frak-updater|open_store"
    );
    return response.opened;
}
