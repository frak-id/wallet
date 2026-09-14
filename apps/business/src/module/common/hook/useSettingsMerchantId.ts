import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { activeMerchantStore } from "@/stores/activeMerchantStore";

/**
 * Active merchant id for routes without a `/m/$merchantId` segment (e.g.
 * `/settings/billing`), where `useActiveMerchantId()` would throw. The
 * remembered id must be resolved against ALL viewable merchants: a platform
 * admin can select a read-only merchant in the picker.
 */
export function useSettingsMerchantId(): string | undefined {
    const lastMerchantId = activeMerchantStore((s) => s.lastMerchantId);
    const { merchants, accessibleMerchants } = useMyMerchants();

    const remembered = merchants.find((m) => m.id === lastMerchantId);
    return (remembered ?? accessibleMerchants[0] ?? merchants[0])?.id;
}
