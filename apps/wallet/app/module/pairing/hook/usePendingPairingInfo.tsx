import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

/**
 * Hook to get the pairing code from the URL
 * @returns The pairing code
 */
export function usePendingPairingInfo() {
    const search = useSearch({ strict: false });
    const navigate = useNavigate();

    const pairingInfo = useMemo(() => {
        const id = (search as { id?: string }).id;
        return id ? { id } : null;
    }, [search]);

    const resetPairingInfo = useCallback(() => {
        const currentSearch = search as Record<string, unknown>;
        const { id, ...rest } = currentSearch;
        navigate({
            search: rest as never,
            replace: true,
        });
    }, [navigate, search]);

    return { pairingInfo, resetPairingInfo };
}
