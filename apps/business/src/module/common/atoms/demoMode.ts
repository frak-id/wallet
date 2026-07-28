import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Hook to get and set demo mode state
 * Automatically invalidates queries when demo mode changes
 */
export function useDemoMode() {
    const token = useAuthStore((state) => state.token);
    const setAuth = useAuthStore((state) => state.setAuth);
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const queryClient = useQueryClient();

    const isDemoMode = token === "demo-token";

    const setDemoMode = (value: boolean) => {
        if (value) {
            setAuth({
                token: "demo-token",
                wallet: ZERO_ADDRESS,
                authMethod: "siwe",
                expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
            });
        } else {
            clearAuth();
        }

        // Invalidate queries if demo mode changed
        queryClient.invalidateQueries();
    };

    return {
        isDemoMode,
        setDemoMode,
    };
}

/**
 * Simple hook to check if demo mode is active
 * Returns true if demo mode is enabled via token
 */
export function useIsDemoMode(): boolean {
    const { isDemoMode } = useDemoMode();
    return isDemoMode;
}
