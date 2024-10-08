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

                await NexusContextManager.replaceUrl({
                    url: location?.href,
                    context: newContext,
                });
            },
        });

    return {
        nexusContext,
        updateContext,
        updateContextAsync,
    };
}
