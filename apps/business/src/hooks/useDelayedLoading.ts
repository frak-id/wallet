import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Hook to show a loading indicator only after a delay
 * This prevents flashing spinners on fast navigations
 *
 * @param delay - Delay in milliseconds before showing the spinner (default: 200ms)
 * @returns Whether to show the loading indicator
 */
export function useDelayedLoading(delay = 200): boolean {
    const isLoading = useRouterState({ select: (s) => s.status === "pending" });
    const [isMounted, setIsMounted] = useState(false);
    const [showSpinner, setShowSpinner] = useState(false);

    // Only show loading indicator after client-side hydration to avoid SSR mismatch
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Delay showing spinner to avoid flashing on fast navigations
    useEffect(() => {
        if (!isMounted) return;

        if (isLoading) {
            // Only show spinner if loading takes longer than the specified delay
            const timeout = setTimeout(() => {
                setShowSpinner(true);
            }, delay);

            return () => clearTimeout(timeout);
        }

        // Immediately hide spinner when loading completes
        setShowSpinner(false);
    }, [isLoading, isMounted, delay]);

    return showSpinner;
}
