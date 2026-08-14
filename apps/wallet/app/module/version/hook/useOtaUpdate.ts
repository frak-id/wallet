import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { useQuery } from "@tanstack/react-query";
import { versionKey } from "../queryKeys/version";
import { type OtaUpdateResult, stageOtaUpdate } from "../utils/otaUpdater";

/**
 * Runs one CrabNebula OTA pass per app session.
 *
 * A pending update is a full bundle download, so this never refetches on
 * focus or interval — the Rust plugin already probes the CDN on every cold
 * start, which is the cadence that matters.
 *
 * Returns `true` once new assets are staged. They are persisted, so the next
 * cold start picks them up; nothing here reloads the webview, which would
 * drop an in-flight signing or recovery flow.
 */
export function useOtaUpdate(): boolean {
    const { data } = useQuery<OtaUpdateResult>({
        queryKey: versionKey.otaStatus,
        queryFn: stageOtaUpdate,
        enabled: IS_TAURI,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: false,
    });

    return data?.status === "staged";
}
