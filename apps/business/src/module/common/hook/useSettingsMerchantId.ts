import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { activeMerchantStore } from "@/stores/activeMerchantStore";

/**
 * Resolves the active merchant id for routes that are NOT merchant-scoped in
 * their URL (e.g. `/settings/billing`), where `useActiveMerchantId()` would
 * throw because there is no `/m/$merchantId` match to read from.
 *
 * Mirrors `resolveActiveMerchant`: prefer the merchant the user was last
 * working in (if still accessible), otherwise the first accessible merchant.
 * Returns `undefined` when the user has no accessible merchant.
 */
export function useSettingsMerchantId(): string | undefined {
    const lastMerchantId = activeMerchantStore((s) => s.lastMerchantId);
    const { accessibleMerchants } = useMyMerchants();

    const remembered = accessibleMerchants.find(
        (m) => m.id === lastMerchantId
    );
    return (remembered ?? accessibleMerchants[0])?.id;
}
