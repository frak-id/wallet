import { useEffect, useState } from "react";

/**
 * Hook to detect if the component has been hydrated on the client.
 * Returns false during server-side rendering and initial client render,
 * then true after hydration completes.
 *
 * Useful for preventing hydration mismatches when using client-only features
 * like localStorage, window, or other browser APIs.
 *
 * @returns {boolean} Whether the component has been hydrated
 */
export function useHydrated(): boolean {
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    return isHydrated;
}
