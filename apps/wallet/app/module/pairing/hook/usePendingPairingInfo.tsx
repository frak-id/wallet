import { pairingStore } from "@frak-labs/wallet-shared/stores/pairingStore";
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Hook to get the pairing code from the URL
 * @returns The pairing code
 */
export function usePendingPairingInfo() {
    const [searchParams] = useSearchParams();
    const pairingInfo = pairingStore((state) => state.pendingPairing);
    const id = useMemo(() => searchParams.get("id"), [searchParams]);

    const resetPairingInfo = useCallback(() => {
        pairingStore.getState().setPendingPairing(null);
    }, []);

    useEffect(() => {
        if (!id) return;
        pairingStore.getState().setPendingPairing({ id });
    }, [id]);

    return useMemo(
        () => ({ pairingInfo, resetPairingInfo }),
        [pairingInfo, resetPairingInfo]
    );
}
