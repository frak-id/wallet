import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

export function useMyMerchants() {
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(myMerchantsQueryOptions(isDemoMode));

    const isPlatformAdmin = data.isPlatformAdmin ?? false;

    // Merchants the user actually owns or administers — everything else a
    // platform admin sees is view-only.
    const accessibleIds = useMemo(() => {
        const ids = new Set<string>();
        for (const m of data.owned ?? []) ids.add(m.id);
        for (const m of data.adminOf ?? []) ids.add(m.id);
        return ids;
    }, [data.owned, data.adminOf]);

    // Merchants the user owns or administers, alphabetically sorted.
    // CRITICAL: useMemo prevents new array on every render (would cause infinite loops in useEffect)
    const accessibleMerchants = useMemo(
        () =>
            [...(data.owned ?? []), ...(data.adminOf ?? [])].sort((a, b) =>
                a.name.localeCompare(b.name)
            ),
        [data.owned, data.adminOf]
    );

    // Read-only merchants a platform admin can view but not manage.
    const readOnlyMerchants = useMemo(() => {
        if (!isPlatformAdmin) return [];
        return (data.allMerchants ?? [])
            .filter((m) => !accessibleIds.has(m.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [data.allMerchants, isPlatformAdmin, accessibleIds]);

    // Accessible merchants first, read-only ones below.
    const merchants = useMemo(
        () => [...accessibleMerchants, ...readOnlyMerchants],
        [accessibleMerchants, readOnlyMerchants]
    );

    const isReadOnly = useCallback(
        (merchantId: string) =>
            isPlatformAdmin && !accessibleIds.has(merchantId),
        [isPlatformAdmin, accessibleIds]
    );

    return {
        isEmpty: merchants.length === 0,
        merchants,
        accessibleMerchants,
        readOnlyMerchants,
        owned: data.owned ?? [],
        adminOf: data.adminOf ?? [],
        isPlatformAdmin,
        isReadOnly,
    };
}
