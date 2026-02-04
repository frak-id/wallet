import {
    pairingStore,
    selectPendingPairingExpiresAt,
    selectPendingPairingId,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useMemo } from "react";

/**
 * Hook to get the pairing code from the store
 * @returns The pairing code
 */
export function usePendingPairingInfo() {
    const pairingId = pairingStore(selectPendingPairingId);
    const pairingExpiresAt = pairingStore(selectPendingPairingExpiresAt);
    const isExpired =
        pairingExpiresAt !== null && pairingExpiresAt <= Date.now();

    useEffect(() => {
        if (!pairingId || !pairingExpiresAt) {
            return;
        }

        const timeLeft = pairingExpiresAt - Date.now();

        if (timeLeft <= 0) {
            pairingStore.getState().clearPendingPairing();
            return;
        }

        const timeoutId = setTimeout(() => {
            pairingStore.getState().clearPendingPairing();
        }, timeLeft);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [pairingId, pairingExpiresAt]);

    const pairingInfo = useMemo(() => {
        if (!pairingId || isExpired) {
            return null;
        }

        return { id: pairingId };
    }, [pairingId, isExpired]);

    const resetPairingInfo = useCallback(() => {
        pairingStore.getState().clearPendingPairing();
    }, []);

    return { pairingInfo, resetPairingInfo };
}
