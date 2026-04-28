import { useCallback } from "react";
import type { OriginPairingClient } from "../clients/origin";

/**
 * Hook returning a stable callback that cancels every in-flight signature
 * request on the origin pairing client — used at "user clearly abandoned"
 * moments (modal dismissal, SSO teardown, page unload).
 *
 * Each pending promise rejects with `cause: "user-cancelled"` and a
 * `signature-reject` message is sent to the server so the target's UI clears
 * immediately instead of waiting for the server's TTL.
 *
 * Returns the count of requests actually cancelled.
 */
export function useCancelAllSignatureRequests({
    client,
}: {
    client: OriginPairingClient;
}) {
    return useCallback(
        (detail?: string): number => {
            return client.cancelAllSignatureRequests(detail);
        },
        [client]
    );
}
