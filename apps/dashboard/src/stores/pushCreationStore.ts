"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush";

type PushCreationState = {
    currentPushCreationForm: FormCreatePushNotification | undefined;
    setForm: (form: FormCreatePushNotification | undefined) => void;
    clearForm: () => void;
};

/**
 * Store for push notification creation form
 * Persists form state for recovery after page refresh or navigation
 */
export const pushCreationStore = create<PushCreationState>()(
    persist(
        (set) => ({
            currentPushCreationForm: undefined,

            setForm: (form) => {
                set({ currentPushCreationForm: form });
            },

            clearForm: () => {
                set({ currentPushCreationForm: undefined });
            },
        }),
        {
            name: "currentPushCampaignForm",
        }
    )
);
