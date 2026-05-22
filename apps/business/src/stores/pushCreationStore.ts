import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";

type PushCreationState = {
    currentPushCreationForm: FormCreatePushNotification | undefined;
    /**
     * Merchant the persisted draft belongs to. Compared against the URL
     * merchantId in route guards so a draft started for merchant A
     * doesn't silently publish under merchant B after a switch.
     */
    draftMerchantId: string | undefined;
    setForm: (
        form: FormCreatePushNotification | undefined,
        merchantId?: string
    ) => void;
    clearForm: () => void;
};

/**
 * Store for push notification creation form
 * Persists form state for recovery after page refresh or navigation.
 *
 * Storage is intentionally left as zustand's default (`localStorage`,
 * synchronous) so route loaders can call `getState()` in `beforeLoad`
 * without a hydration race — see `/m/$merchantId/push/confirm`. Do not
 * swap in an async storage backend (IDB, network) without first adding
 * `useStore.persist.hasHydrated()` checks at every read site.
 */
export const pushCreationStore = create<PushCreationState>()(
    persist(
        (set) => ({
            currentPushCreationForm: undefined,
            draftMerchantId: undefined,

            setForm: (form, merchantId) => {
                if (!form) {
                    set({
                        currentPushCreationForm: undefined,
                        draftMerchantId: undefined,
                    });
                    return;
                }
                set({
                    currentPushCreationForm: form,
                    draftMerchantId: merchantId,
                });
            },

            clearForm: () => {
                set({
                    currentPushCreationForm: undefined,
                    draftMerchantId: undefined,
                });
            },
        }),
        {
            name: "currentPushCampaignForm",
        }
    )
);
