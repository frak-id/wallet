import { isAndroid, isIOS } from "@frak-labs/app-essentials/utils/platform";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { isBelow } from "../utils/compareVersions";
import {
    checkNativeUpdate,
    type NativeUpdateStatus,
} from "../utils/nativeUpdater";

export type VersionGateState =
    | { kind: "idle" }
    | { kind: "hard_update"; currentVersion: string; minVersion: string }
    | {
          kind: "soft_update";
          storeVersion?: string;
      }
    | {
          kind: "soft_update_in_progress";
          bytesDownloaded: number;
          totalBytes: number;
      }
    | { kind: "soft_update_downloaded" };

/**
 * 5 min cache: the wallet refetches on focus anyway, this just avoids
 * spamming Apple's iTunes endpoint and our backend during fast nav.
 */
const STALE_TIME_MS = 5 * 60 * 1000;

const minVersionQueryOptions = {
    queryKey: ["version", "min-supported"] as const,
    queryFn: async () => {
        const { data, error } =
            await authenticatedBackendApi.common.version.get();
        // Propagate Eden errors so TanStack Query keeps its retry/backoff
        // semantics; previous `return null` masked failures and silently
        // disabled the hard-update floor until the next stale window.
        if (error) throw error;
        if (!data) throw new Error("Missing version response from backend");
        return data.minVersion;
    },
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
} as const;

const nativeUpdateQueryOptions = {
    queryKey: ["version", "native-status"] as const,
    queryFn: async (): Promise<NativeUpdateStatus> => checkNativeUpdate(),
    staleTime: STALE_TIME_MS,
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
    const enabled = isIOS() || isAndroid();

    const minVersion = useQuery({
        ...minVersionQueryOptions,
        enabled,
    });
    const native = useQuery({
        ...nativeUpdateQueryOptions,
        enabled,
    });

    if (!enabled) return { kind: "idle" };

    const platformKey: "ios" | "android" | null = isIOS()
        ? "ios"
        : isAndroid()
          ? "android"
          : null;
    if (!platformKey) return { kind: "idle" };

    const currentVersion = native.data?.currentVersion ?? "";
    const minRequired = minVersion.data?.[platformKey];

    if (
        currentVersion &&
        minRequired &&
        minRequired !== "0.0.0" &&
        isBelow(currentVersion, minRequired)
    ) {
        return {
            kind: "hard_update",
            currentVersion,
            minVersion: minRequired,
        };
    }

    if (native.data?.status === "in_progress") {
        return {
            kind: "soft_update_in_progress",
            bytesDownloaded: native.data.bytesDownloaded,
            totalBytes: native.data.totalBytes,
        };
    }
    if (native.data?.status === "downloaded") {
        return { kind: "soft_update_downloaded" };
    }
    if (native.data?.status === "available") {
        return {
            kind: "soft_update",
            storeVersion: native.data.storeVersion,
        };
    }

    return { kind: "idle" };
}
