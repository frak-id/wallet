import { setupReferral } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/**
 * Hook that automatically processes referral context and emits a DOM event on success
 *
 * Runs once when the Frak client becomes available. Fire-and-forget — the referral
 * result is tracked via a `"frak:referral-success"` DOM event on `window`, not via
 * the returned query data.
 *
 * @group hooks
 *
 * @returns The query handle (data is not meaningful — listen for `REFERRAL_SUCCESS_EVENT` on `window` instead)
 *
 * @see {@link @frak-labs/core-sdk!actions.setupReferral | `setupReferral()`} for more info about the underlying action
 * @see {@link @frak-labs/core-sdk!actions.REFERRAL_SUCCESS_EVENT | `REFERRAL_SUCCESS_EVENT`} for the event name constant
 */
export function useSetupReferral() {
    const client = useFrakClient();

    return useQuery({
        queryKey: ["frak-sdk", "setup-referral"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            await setupReferral(client);
            return null;
        },
        enabled: !!client,
        staleTime: Number.POSITIVE_INFINITY,
    });
}
