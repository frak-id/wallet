import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { pendingPairingAtom } from "@/pairing/atoms/code";

/**
 * Hook to get the pairing code from the URL
 * @returns The pairing code
 */
export function usePendingPairingInfo() {
    const [searchParams] = useSearchParams();
    const [pairingInfo, setPairingInfo] = useAtom(pendingPairingAtom);
    const id = useMemo(() => searchParams.get("id"), [searchParams]);

    const resetPairingInfo = useCallback(() => {
        setPairingInfo(null);
    }, [setPairingInfo]);

    useEffect(() => {
        if (!id) return;
        setPairingInfo({ id });
    }, [id, setPairingInfo]);

    return useMemo(
        () => ({ pairingInfo, resetPairingInfo }),
        [pairingInfo, resetPairingInfo]
    );
}
