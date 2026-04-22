import type { EventMap } from "./events";
import { openPanel } from "./openpanel";

/**
 * Typed OpenPanel wrapper — call sites get autocomplete on event names and
 * compile-time checks on properties. Module-level export so Zustand stores and
 * plain utilities can emit without wiring React context.
 */
export function trackEvent<K extends keyof EventMap>(
    event: K,
    properties?: EventMap[K]
): void {
    if (!openPanel) return;
    openPanel.track(
        event as string,
        properties as Record<string, unknown> | undefined
    );
}
