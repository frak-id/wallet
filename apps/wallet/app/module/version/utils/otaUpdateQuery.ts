import { recordError } from "@frak-labs/wallet-shared";
import { queryOptions } from "@tanstack/react-query";
import { versionKey } from "../queryKeys/version";
import { stageOtaUpdate } from "./otaUpdater";

const RECHECK_AFTER_MS = 5 * 60 * 1000;

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
        query.state.data?.status === "staged" ? "static" : RECHECK_AFTER_MS,
    retry: false,
    meta: { storable: false },
});
