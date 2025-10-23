/**
 * Zustand store for browser-specific state
 */

import { create } from "zustand";
import type { BrowserStore } from "./types";

/**
 * Browser store managing in-app browser and social redirect state
 * In-memory only (session-specific state, not persisted)
 */
export const browserStore = create<BrowserStore>((set) => ({
    // Initial state
    inAppBrowserToastDismissed: false,
    socialRedirectAttempted: false,

    // Actions
    setInAppBrowserToastDismissed: (inAppBrowserToastDismissed) =>
        set({ inAppBrowserToastDismissed }),
    setSocialRedirectAttempted: (socialRedirectAttempted) =>
        set({ socialRedirectAttempted }),
    clearBrowser: () =>
        set({
            inAppBrowserToastDismissed: false,
            socialRedirectAttempted: false,
        }),
}));

/**
 * Selector functions for computed values
 */

// Get in-app browser toast dismissed state
export const selectInAppBrowserToastDismissed = (state: BrowserStore) =>
    state.inAppBrowserToastDismissed;

// Get social redirect attempted state
export const selectSocialRedirectAttempted = (state: BrowserStore) =>
    state.socialRedirectAttempted;
