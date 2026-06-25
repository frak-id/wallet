import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

export function useMyMerchants() {
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(myMerchantsQueryOptions(isDemoMode));

    const isPlatformAdmin = data.isPlatformAdmin ?? false;

    // Platform admins see the full merchant list; regular users see owned + adminOf
    // CRITICAL: useMemo prevents new array on every render (would cause infinite loops in useEffect)
    const merchants = useMemo(() => {
        const base = isPlatformAdmin
            ? (data.allMerchants ?? [
                  ...(data.owned ?? []),
                  ...(data.adminOf ?? []),
              ])
            : [...(data.owned ?? []), ...(data.adminOf ?? [])];
        return base.sort((a, b) => a.name.localeCompare(b.name));
    }, [data.owned, data.adminOf, data.allMerchants, isPlatformAdmin]);

    // Merchants the user actually owns or administers — everything else a
    // platform admin sees is view-only.
    const accessibleIds = useMemo(() => {
        const ids = new Set<string>();
        for (const m of data.owned ?? []) ids.add(m.id);
        for (const m of data.adminOf ?? []) ids.add(m.id);
        return ids;
    }, [data.owned, data.adminOf]);

    const isReadOnly = useCallback(
        (merchantId: string) =>
            isPlatformAdmin && !accessibleIds.has(merchantId),
        [isPlatformAdmin, accessibleIds]
    );

    return {
        isEmpty: merchants.length === 0,
        merchants,
        owned: data.owned ?? [],
        adminOf: data.adminOf ?? [],
        isPlatformAdmin,
        isReadOnly,
    };
}
