"use client";

import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type DemoModeState = {
    isDemoMode: boolean;
    setDemoMode: (isDemoMode: boolean, queryClient?: QueryClient) => void;
};

/**
 * Store for demo mode preference
 * Persists demo mode state and syncs to cookies for server-side access
 */
export const demoModeStore = create<DemoModeState>()(
    persist(
        (set, get) => ({
            isDemoMode: false,

            setDemoMode: (isDemoMode, queryClient) => {
                const previousDemoMode = get().isDemoMode;

                // Update state
                set({ isDemoMode });

                // Sync to cookies for server-side access
                if (typeof document !== "undefined") {
                    document.cookie = `business_demoMode=${isDemoMode}; path=/; max-age=31536000; SameSite=Lax`;
                }

                // Invalidate queries if demo mode changed
                if (queryClient && previousDemoMode !== isDemoMode) {
                    queryClient.invalidateQueries();
                }
            },
        }),
        {
            name: "business_demoMode",
        }
    )
);
