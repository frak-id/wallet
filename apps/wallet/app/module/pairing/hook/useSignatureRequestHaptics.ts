import { getTargetPairingClient } from "@frak-labs/wallet-shared";
import { useEffect } from "react";
import { notifyHaptic } from "@/utils/haptics";

/**
 * Fire a short haptic buzz whenever a genuinely new signature request lands
 * in the target pairing client.
 *
 * Subscribes directly to the client's store (single source of truth) instead
 * of reacting to component renders, so it fires exactly once per arrival
 * regardless of what UI is mounted. Requests already pending when the
 * subscription attaches are seeded as "known" and do not buzz.
 *
 * Mounted once at the app root.
 */
export function useSignatureRequestHaptics() {
    useEffect(() => {
        const { store } = getTargetPairingClient();
        let knownIds = new Set(store.getState().pendingSignatures.keys());

        return store.subscribe((state) => {
            const ids = new Set(state.pendingSignatures.keys());
            let hasNew = false;
            for (const id of ids) {
                if (!knownIds.has(id)) {
                    hasNew = true;
                    break;
                }
            }
            knownIds = ids;
            if (hasNew) void notifyHaptic();
        });
    }, []);
}
