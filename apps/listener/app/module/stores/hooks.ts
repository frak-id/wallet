/**
 * React hooks for accessing Zustand stores
 */

import { resolvingContextStore } from "./resolvingContextStore";

/**
 * Hook to safely get the current resolving context
 * Throws an error if no context is available
 */
export function useSafeResolvingContext() {
    const context = resolvingContextStore((state) => state.context);
    if (!context) {
        throw new Error("No resolving context available");
    }
    return context;
}
