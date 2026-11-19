import { recordError } from "@frak-labs/wallet-shared";
import { queryOptions } from "@tanstack/react-query";
import { versionKey } from "../queryKeys/version";
import { stageOtaUpdate } from "./otaUpdater";
import { VERSION_STALE_TIME_MS } from "./staleTime";

/** Shared by the boot gate and `useVersionGate`: a check the gate stopped waiting for lands in the same entry. */
export const otaUpdateQueryOptions = queryOptions({
    queryKey: versionKey.otaUpdate,
    queryFn: () =>
        stageOtaUpdate().catch((error: unknown) => {
            recordError(error, { source: "ota_update" });
            throw error;
        }),
    // A staged bundle stays staged until the reload: re-checking could hide the prompt.
    staleTime: (query) =>
        query.state.data?.status === "staged"
            ? "static"
            : VERSION_STALE_TIME_MS,
    retry: false,
    meta: { storable: false },
});
