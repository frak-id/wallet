import { create } from "zustand";
import { persist } from "zustand/middleware";

type WelcomePopupState = {
    hasSeenWelcome: boolean;
    markWelcomeSeen: () => void;
};

/**
 * Store for the "new dashboard" welcome popup.
 * Persists whether the user has dismissed the announcement so it only
 * shows once. The versioned key allows re-showing for a future redesign.
 */
export const welcomePopupStore = create<WelcomePopupState>()(
    persist(
        (set) => ({
            hasSeenWelcome: false,
            markWelcomeSeen: () => set({ hasSeenWelcome: true }),
        }),
        {
            name: "business_welcomePopup_v1",
        }
    )
);
