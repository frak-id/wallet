import { isRunningInProd } from "@frak-labs/app-essentials";

let retryTimeout: ReturnType<typeof setTimeout> | null = null;
const MAX_RETRIES = 3;

/**
 * Track events with umami analytics
 * @param name
 * @param params
 * @param retryCount
 */
export function trackEvent(
    name: string,
    params?: Record<string, unknown>,
    retryCount = 0
) {
    if (!isRunningInProd) {
        console.log("Skipping analytics, not running in prod", {
            name,
            params,
        });
        return;
    }

    // Check if we're in a browser environment and umami exists
    if (typeof window === "undefined" || !window.umami) {
        // Give up after MAX_RETRIES attempts
        if (retryCount >= MAX_RETRIES) {
            console.log(`Failed to track event after ${MAX_RETRIES} attempts`, {
                name,
                params,
            });
            if (retryTimeout) clearTimeout(retryTimeout);
            return;
        }

        console.log(
            `Umami analytics not loaded (attempt ${retryCount + 1}/${MAX_RETRIES})`,
            { name, params }
        );

        // Clear any existing timeout
        if (retryTimeout) {
            clearTimeout(retryTimeout);
        }

        // Retry mechanism
        retryTimeout = setTimeout(() => {
            trackEvent(name, params, retryCount + 1);
            retryTimeout = null; // Clear the reference after execution
        }, 5000); // Retry after 5 seconds

        return;
    }

    try {
        window.umami.track(name, params);
    } catch (error) {
        console.error("Error tracking event:", error);
    }
}
