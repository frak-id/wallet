import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Hook to get the pairing code from the URL
 * @returns The pairing code
 */
export function usePendingPairingInfo() {
    const [searchParams, setSearchParams] = useSearchParams();

    const pairingInfo = useMemo(() => {
        const id = searchParams.get("id");
        return id ? { id } : null;
    }, [searchParams]);

    const resetPairingInfo = useCallback(() => {
        setSearchParams((prev) => {
            const newParams = new URLSearchParams(prev);
            newParams.delete("id");
            return newParams;
        });
    }, [setSearchParams]);

    return { pairingInfo, resetPairingInfo };
}
