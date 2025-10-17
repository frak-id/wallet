"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useEffect, useRef } from "react";

/**
 * Atom to store demo mode preference in localStorage
 */
export const demoModeAtom = atomWithStorage<boolean>(
    "business_demoMode",
    false
);

/**
 * Hook to get and set demo mode state
 * Syncs state to cookies for server-side access
 * Automatically invalidates queries when demo mode changes
 */
export function useDemoMode() {
    const [isDemoMode, setDemoMode] = useAtom(demoModeAtom);
    const queryClient = useQueryClient();
    const previousDemoMode = useRef<boolean | null>(null);

    // Sync demo mode to cookies for server-side access
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.cookie = `business_demoMode=${isDemoMode}; path=/; max-age=31536000; SameSite=Lax`;
        }
    }, [isDemoMode]);

    // Invalidate and refetch all queries when demo mode changes
    useEffect(() => {
        if (
            previousDemoMode.current !== null &&
            previousDemoMode.current !== isDemoMode
        ) {
            queryClient.invalidateQueries();
        }
        previousDemoMode.current = isDemoMode;
    }, [isDemoMode, queryClient]);

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
