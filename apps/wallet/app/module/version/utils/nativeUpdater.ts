import { isAndroid, isIOS } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke } from "@frak-labs/wallet-shared";
import { isBelow } from "./compareVersions";

/**
 * Consumer-facing native update status.
 *
 * `available.storeVersion` is optional because Android (Play Core) does
 * not expose a human-readable version string for the pending release —
 * iOS surfaces the iTunes Lookup version, Android omits the field.
 */
export type NativeUpdateStatus =
    | { status: "up_to_date"; currentVersion: string }
    | {
          status: "available";
          currentVersion: string;
          storeVersion?: string;
      }
    | {
          status: "in_progress";
          currentVersion: string;
          bytesDownloaded: number;
          totalBytes: number;
      }
    | { status: "downloaded"; currentVersion: string }
    | { status: "unsupported"; currentVersion: string };

/**
 * Raw shape emitted by the native plugin. iOS reports `candidate` whenever
 * iTunes Lookup returns a version (no comparison done natively); Android
 * reports a fully-resolved status enum since Play Core decides availability
 * server-side. Internal to this module — normalised into `NativeUpdateStatus`
 * by `checkNativeUpdate` so consumers don't see the platform asymmetry.
 */
type RawNativeUpdate =
    | { status: "up_to_date"; currentVersion: string }
    | { status: "available"; currentVersion: string }
    | {
          status: "candidate";
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
    const invoke = await getInvoke();
    const raw = await invoke<RawNativeUpdate>(
        "plugin:frak-updater|check_update"
    );

    // iOS hands us the raw iTunes Lookup version; the comparison lives in
    // TS so version semantics stay in a single source of truth shared with
    // the hard-update gate (`isBelow` against the backend `minVersion`).
    if (raw.status === "candidate") {
        if (isBelow(raw.currentVersion, raw.storeVersion)) {
            return {
                status: "available",
                currentVersion: raw.currentVersion,
                storeVersion: raw.storeVersion,
            };
        }
        return {
            status: "up_to_date",
            currentVersion: raw.currentVersion,
        };
    }
    return raw;
}

export async function startNativeSoftUpdate(): Promise<boolean> {
    if (!isIOS() && !isAndroid()) return false;
    const invoke = await getInvoke();
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
    const invoke = await getInvoke();
    const response = await invoke<CompleteSoftUpdateResponse>(
        "plugin:frak-updater|complete_soft_update"
    );
    return response.completed;
}

export async function openNativeStore(): Promise<boolean> {
    if (!isIOS() && !isAndroid()) return false;
    const invoke = await getInvoke();
    const response = await invoke<OpenStoreResponse>(
        "plugin:frak-updater|open_store"
    );
    return response.opened;
}
