import { useMutation, useQuery } from "@tanstack/react-query";
import { NexusContextManager } from "../../../core";
import type { NexusContext } from "../../types/NexusContext";
import { useWindowLocation } from "./useWindowLocation";

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

            // Parse the current context
            return NexusContextManager.parse({ url: location.href });
        },
        enabled: !!location?.href,
    });

    /**
     * Update the current context
     */
    const { mutate: updateContext, mutateAsync: updateContextAsync } =
        useMutation({
            mutationKey: ["nexus-sdk", "update-context"],
            mutationFn: async (newContext: Partial<NexusContext>) => {
                console.log("Updating context", { newContext });

                // If no window here early exit
                if (!location?.href || typeof window === "undefined") {
                    console.error("No window found, can't update context");
                    return;
                }

                // Get our new url with the nexus context
                const newUrl = await NexusContextManager.update({
                    url: location.href,
                    context: newContext,
                });

                // Update the url
                window.history.replaceState(null, "", newUrl);
            },
        });

    return {
        nexusContext,
        updateContext,
        updateContextAsync,
    };
}
