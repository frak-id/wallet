import { useMutation, useQuery } from "@tanstack/react-query";
import { FrakContextManager } from "../../../core";
import type { FrakContext } from "../../types/FrakContext";
import { useWindowLocation } from "./useWindowLocation";

/**
 * Extract the current nexus context from the url
 */
export function useFrakContext() {
    // Get the current window location
    const { location } = useWindowLocation();

    /**
     * Query fetching and parsing the current nexus context
     */
    const { data: frakContext } = useQuery({
        queryKey: ["nexus-sdk", "context", location?.href ?? "no-href"],
        queryFn: async () => {
            // If no url extracted yet, early exit
            if (!location?.href) return null;

            // Parse the current context
            return FrakContextManager.parse({ url: location.href });
        },
        enabled: !!location?.href,
    });

    /**
     * Update the current context
     */
    const { mutate: updateContext, mutateAsync: updateContextAsync } =
        useMutation({
            mutationKey: ["nexus-sdk", "update-context"],
            mutationFn: async (newContext: Partial<FrakContext>) => {
                console.log("Updating context", { newContext });

                await FrakContextManager.replaceUrl({
                    url: location?.href,
                    context: newContext,
                });
            },
        });

    return {
        frakContext,
        updateContext,
        updateContextAsync,
    };
}
