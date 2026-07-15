import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { activeMerchantStore } from "@/stores/activeMerchantStore";

/**
 * Resolves the active merchant id for routes that are NOT merchant-scoped in
 * their URL (e.g. `/settings/billing`), where `useActiveMerchantId()` would
 * throw because there is no `/m/$merchantId` match to read from.
 *
 * Prefer the merchant the user was last working in, resolved against ALL
 * viewable merchants — including a platform admin's read-only ones. Filtering
 * to `accessibleMerchants` here silently dropped a read-only selection made in
 * the picker (which does let a platform admin switch to any merchant, see
 * `/m/$merchantId` layout), snapping the settings/billing view back to the
 * first accessible merchant while the picker showed the newly-selected one.
 *
 * Falls back to the first accessible merchant (then any viewable one) when
 * nothing is remembered. Returns `undefined` when there is no viewable
 * merchant at all.
 */
export function useSettingsMerchantId(): string | undefined {
    const lastMerchantId = activeMerchantStore((s) => s.lastMerchantId);
    const { merchants, accessibleMerchants } = useMyMerchants();

    const remembered = merchants.find((m) => m.id === lastMerchantId);
    return (remembered ?? accessibleMerchants[0] ?? merchants[0])?.id;
}
