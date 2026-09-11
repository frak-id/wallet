import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

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

        queryClient.invalidateQueries();
    };

    return {
        isDemoMode,
        setDemoMode,
    };
}

export function useIsDemoMode(): boolean {
    return useAuthStore((state) => state.token === "demo-token");
}
