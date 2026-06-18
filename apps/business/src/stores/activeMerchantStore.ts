import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveMerchantState = {
    lastMerchantId: string | null;
    setLastMerchantId: (merchantId: string) => void;
};

/**
 * Remembers the merchant the user was last working in, so routes without a
 * `merchantId` param (settings, legacy `/dashboard`) stay on that merchant
 * instead of snapping back to the first one.
 */
export const activeMerchantStore = create<ActiveMerchantState>()(
    persist(
        (set) => ({
            lastMerchantId: null,
            setLastMerchantId: (merchantId) =>
                set({ lastMerchantId: merchantId }),
        }),
        {
            name: "business_lastMerchantId",
            partialize: (state) => ({ lastMerchantId: state.lastMerchantId }),
        }
    )
);
