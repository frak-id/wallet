import {
    IS_ANDROID,
    IS_IOS,
    IS_TAURI,
} from "@frak-labs/app-essentials/utils/platform";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PluginListener } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { versionKey } from "../queryKeys/version";
import { isBelow } from "../utils/compareVersions";
import {
    checkNativeUpdate,
    listenToNativeUpdateStatus,
    type NativeUpdateStatus,
} from "../utils/nativeUpdater";
import { otaUpdateQueryOptions } from "../utils/otaUpdateQuery";
import { VERSION_STALE_TIME_MS } from "../utils/staleTime";

export type VersionGateState =
    | { kind: "idle" }
    | { kind: "hard_update"; currentVersion: string; minVersion: string }
    | {
          kind: "soft_update";
          storeVersion?: string;
      }
    | { kind: "soft_update_in_progress" }
    | { kind: "soft_update_downloaded" }
    | { kind: "ota_ready" };

const minVersionQueryOptions = {
    queryKey: versionKey.minSupported,
    queryFn: async () => {
        // no-store: the WebView's HTTP cache would otherwise replay a rolled-back floor.
        const { data, error } =
            await authenticatedBackendApi.common.version.get({
                fetch: { cache: "no-store" },
            });
        // Propagate Eden errors so TanStack Query keeps its retry/backoff
        // semantics — a swallowed failure silently disables the hard-update
        // floor until the next stale window.
        if (error) throw error;
        if (!data) throw new Error("Missing version response from backend");
        return data.minVersion;
    },
    refetchOnWindowFocus: true,
} as const;

const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * The build's own version, so the hard floor holds when the store lookup fails.
 * A commit hash (web deploys) would compare as `0` and gate everyone.
 */
function getBuildVersion(): string | undefined {
    const version = process.env.APP_VERSION;
    return version && RELEASE_VERSION.test(version) ? version : undefined;
}

function getPlatformKey(): "ios" | "android" | null {
    return IS_IOS ? "ios" : IS_ANDROID ? "android" : null;
}

function isBlockedByFloor(
    currentVersion: string | undefined,
    floor: string | undefined
): boolean {
    return Boolean(
        currentVersion &&
            floor &&
            floor !== "0.0.0" &&
            isBelow(currentVersion, floor)
    );
}

const nativeUpdateQueryOptions = {
    queryKey: versionKey.nativeStatus,
    queryFn: async (): Promise<NativeUpdateStatus> => checkNativeUpdate(),
    staleTime: VERSION_STALE_TIME_MS,
    refetchOnWindowFocus: true,
} as const;

/**
 * Drives the wallet's version gate.
 *
 * Two parallel signals are combined:
 *   - Backend `minVersion` per platform → hard floor. Below it, the user is
 *     blocked entirely and pushed to the store.
 *   - Native plugin status (iTunes Lookup on iOS, Play Core on Android)
 *     → soft prompt + Play's FLEXIBLE flow lifecycle. iOS soft prompts
 *     deep-link to the App Store; Android shows progress + restart.
 *
 * Hard always wins: even if Play is mid-download, a min-version breach
 * surfaces the blocker (the user can finish the download via Play's UI
 * once the app is replaced, but we never let them keep using the old
 * binary).
 */
export function useVersionGate(): VersionGateState {
    const queryClient = useQueryClient();
    const minVersion = useQuery({
        ...minVersionQueryOptions,
        enabled: IS_TAURI,
        // A blocked app must re-check on every launch and focus to see a lowered floor.
        staleTime: (query) => {
            const platformKey = getPlatformKey();
            const currentVersion =
                getBuildVersion() ??
                queryClient.getQueryData<NativeUpdateStatus>(
                    versionKey.nativeStatus
                )?.currentVersion;
            return platformKey &&
                isBlockedByFloor(
                    currentVersion,
                    query.state.data?.[platformKey]
                )
                ? 0
                : VERSION_STALE_TIME_MS;
        },
    });
    const native = useQuery({
        ...nativeUpdateQueryOptions,
        enabled: IS_TAURI,
        // Safety net for the push channel: while Play Core is mid-download
        // we poll natively every 3s so the UI recovers even if a
        // `update-status` event is missed (e.g. listener registered late,
        // user cancelled the FLEXIBLE consent dialog before any
        // `DOWNLOADING` event fired). Disabled otherwise to avoid wasted
        // work on a quiescent gate.
        refetchInterval: (query) =>
            query.state.data?.status === "in_progress" ? 3000 : false,
    });

    const ota = useQuery({
        ...otaUpdateQueryOptions,
        enabled: IS_TAURI,
        refetchOnWindowFocus: true,
    });

    // Subscribe to the native push channel on Android so download progress
    // and completion land in the cache without waiting for window focus.
    // No-op on iOS / web — the helper resolves to `null` there.
    useEffect(() => {
        if (!IS_TAURI || !IS_ANDROID) return;
        let listener: PluginListener | null = null;
        let cancelled = false;
        listenToNativeUpdateStatus((event) => {
            queryClient.setQueryData<NativeUpdateStatus>(
                versionKey.nativeStatus,
                event
            );
        })
            .then((registered) => {
                if (cancelled) {
                    registered?.unregister();
                    return;
                }
                listener = registered;
            })
            .catch((error) => {
                console.warn(
                    "Failed to subscribe to native update status events:",
                    error
                );
            });
        return () => {
            cancelled = true;
            listener?.unregister();
        };
    }, [queryClient]);

    if (!IS_TAURI) return { kind: "idle" };

    const platformKey = getPlatformKey();
    if (!platformKey) return { kind: "idle" };

    const currentVersion =
        getBuildVersion() ?? native.data?.currentVersion ?? "";
    const minRequired = minVersion.data?.[platformKey];

    if (minRequired && isBlockedByFloor(currentVersion, minRequired)) {
        return {
            kind: "hard_update",
            currentVersion,
            minVersion: minRequired,
        };
    }

    if (native.data?.status === "in_progress") {
        return { kind: "soft_update_in_progress" };
    }
    if (native.data?.status === "downloaded") {
        return { kind: "soft_update_downloaded" };
    }
    if (ota.data?.status === "staged") {
        return { kind: "ota_ready" };
    }
    if (native.data?.status === "available") {
        return {
            kind: "soft_update",
            storeVersion: native.data.storeVersion,
        };
    }

    return { kind: "idle" };
}
