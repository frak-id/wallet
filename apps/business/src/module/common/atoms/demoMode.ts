import { useQueryClient } from "@tanstack/react-query";
import { demoModeStore } from "@/stores/demoModeStore";

/**
 * Hook to get and set demo mode state
 * Syncs state to cookies for server-side access
 * Automatically invalidates queries when demo mode changes
 */
export function useDemoMode() {
    const isDemoMode = demoModeStore((state) => state.isDemoMode);
    const setDemoModeInternal = demoModeStore((state) => state.setDemoMode);
    const queryClient = useQueryClient();

    const setDemoMode = (value: boolean) => {
        setDemoModeInternal(value, queryClient);
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
