import { type FrakContext, FrakContextManager } from "@frak-labs/core-sdk";
import { useCallback, useMemo } from "react";
import { useWindowLocation } from "./useWindowLocation";

/**
 * Extract the current nexus context from the url
 */
export function useFrakContext() {
    // Get the current window location
    const { location } = useWindowLocation();

    /**
     * Fetching and parsing the current nexus context
     */
    const frakContext = useMemo(() => {
        // If no url extracted yet, early exit
        if (!location?.href) return null;

        // Parse the current context
        return FrakContextManager.parse({ url: location.href });
    }, [location?.href]);

    /**
     * Update the current context
     */
    const updateContext = useCallback(
        (newContext: Partial<FrakContext>) => {
            console.log("Updating context", { newContext });
            FrakContextManager.replaceUrl({
                url: location?.href,
                context: newContext,
            });
        },
        [location?.href]
    );

    return {
        frakContext,
        updateContext,
    };
}
