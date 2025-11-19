import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type DemoModeState = {
    isDemoMode: boolean;
    setDemoMode: (isDemoMode: boolean, queryClient?: QueryClient) => void;
};

/**
 * Store for demo mode preference
 * Persists demo mode state to localStorage
 * Demo mode is passed to server via authMiddleware context (no cookies needed)
 */
export const demoModeStore = create<DemoModeState>()(
    persist(
        (set, get) => ({
            isDemoMode: false,

            setDemoMode: (isDemoMode, queryClient) => {
                const previousDemoMode = get().isDemoMode;

                // Update state
                set({ isDemoMode });

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
