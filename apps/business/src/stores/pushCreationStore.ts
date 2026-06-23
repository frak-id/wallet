import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";

type PushCreationState = {
    currentPushCreationForm: FormCreatePushNotification | undefined;
    /**
     * Merchant the persisted draft belongs to. The composer only resumes a
     * draft when it matches the URL merchantId, so a draft started for
     * merchant A doesn't leak into merchant B after a switch.
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
 * synchronous) so the composer can read `getState()` synchronously on
 * mount without a hydration race. Do not swap in an async storage backend
 * (IDB, network) without first adding `useStore.persist.hasHydrated()`
 * checks at every read site.
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
