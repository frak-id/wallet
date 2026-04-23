import type { FrakClient } from "../../types";
import type { SdkEventMap } from "./events";

/**
 * Track an analytics event via the SDK's OpenPanel instance.
 * Fire-and-forget — silently catches errors so analytics never break a
 * partner integration.
 *
 * The client must be passed explicitly because the OpenPanel instance is
 * scoped to each `FrakClient` (a partner site may hold multiple iframes).
 *
 * @param client - The Frak client instance (no-op if undefined)
 * @param event - Typed event name from the SDK event map
 * @param properties - Typed properties for the given event
 */
export function trackEvent<K extends keyof SdkEventMap>(
    client: FrakClient | undefined,
    event: K,
    properties?: SdkEventMap[K]
): void {
    if (!client) {
        console.debug("[Frak] No client provided, skipping event tracking");
        return;
    }

    try {
        client.openPanel?.track(
            event as string,
            properties as Record<string, unknown> | undefined
        );
    } catch (e) {
        console.debug("[Frak] Failed to track event:", event, e);
    }
}
