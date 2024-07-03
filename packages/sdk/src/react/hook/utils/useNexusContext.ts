import { useMutation, useQuery } from "@tanstack/react-query";
import { compressJson, decompressJson } from "../../../core/utils/compression";
import type { NexusContext } from "../../types/NexusContext";
import { useWindowLocation } from "./useWindowLocation";

/**
 * The context key
 */
const contextKey = "nCtx";

/**
 * Extract the current nexus context from the url
 */
export function useNexusContext() {
    // Get the current window location
    const { location } = useWindowLocation();

    /**
     * Query fetching and parsing the current nexus context
     */
    const { data: nexusContext } = useQuery({
        queryKey: ["nexus-sdk", "context", location?.href ?? "no-href"],
        queryFn: async () => {
            // If no url extracted yet, early exit
            if (!location?.href) return null;

            // Check if the url contain the nexus context key
            const url = new URL(location.href);
            const nexusContext = url.searchParams.get(contextKey);
            if (!nexusContext) return null;

            // Parse the nexus context
            const parsedContext =
                await decompressJson<NexusContext>(nexusContext);
            if (!parsedContext) return null;

            // Return the parsed context
            return parsedContext;
        },
    });

    /**
     * Update the current context
     */
    const { mutate: updateContext, mutateAsync: updateContextAsync } =
        useMutation({
            mutationKey: ["nexus-sdk", "update-context"],
            mutationFn: async (newContext: Partial<NexusContext>) => {
                // If no window here early exit
                if (!location || typeof window === "undefined") return;

                // Build the new context
                const fullNewContext = nexusContext
                    ? { ...nexusContext, ...newContext }
                    : newContext;

                // Compress the updated context
                const compressedContext = await compressJson(fullNewContext);
                if (!compressedContext) return;

                // Build the new url
                const url = new URL(location.href);
                url.searchParams.set(contextKey, compressedContext);

                // Update the url
                window.history.replaceState(null, "", url.toString());
            },
        });

    return { nexusContext, updateContext, updateContextAsync };
}
