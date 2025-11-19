import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";

/**
 * Hook to get and set demo mode state
 * Automatically invalidates queries when demo mode changes
 */
export function useDemoMode() {
    const isDemoMode = useAuthStore((state) => state.isDemoMode);
    const setDemoModeInternal = useAuthStore((state) => state.setDemoMode);
    const queryClient = useQueryClient();

    const setDemoMode = (value: boolean) => {
        const previousDemoMode = isDemoMode;
        setDemoModeInternal(value);

        // Invalidate queries if demo mode changed
        if (previousDemoMode !== value) {
            queryClient.invalidateQueries();
        }
    };

    return {
        isDemoMode,
        setDemoMode,
    };
}

/**
 * Simple hook to check if demo mode is active
 * Returns true if demo mode is enabled via localStorage
 */
export function useIsDemoMode(): boolean {
    const { isDemoMode } = useDemoMode();
    return isDemoMode;
}
