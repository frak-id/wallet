import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { useQuery } from "@tanstack/react-query";
import { versionKey } from "../queryKeys/version";
import { type OtaUpdateResult, stageOtaUpdate } from "../utils/otaUpdater";

/**
 * One OTA pass per session: the only check on the real channel, since the Rust
 * boot probe only sees `unset`. An update is a full bundle download, so no refetch.
 * `true` once assets are staged for the next cold start; never reloads the
 * webview, which would drop an in-flight signing or recovery flow.
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
