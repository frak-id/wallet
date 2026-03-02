import type { FrakClient } from "../types";

/**
 * Analytics event names emitted by the SDK
 */
export type FrakEvent =
    | "share_button_clicked"
    | "wallet_button_clicked"
    | "open_in_app_clicked"
    | "open_in_app_login_clicked"
    | "app_not_installed"
    | "share_modal_error"
    | "user_referred_started"
    | "user_referred_completed"
    | "user_referred_error";

type EventProps = Record<string, unknown>;

/**
 * Track an analytics event via OpenPanel.
 * Fire-and-forget: silently catches errors.
 * @param client - The Frak client instance (no-op if undefined)
 * @param event - The event name to track
 * @param props - Optional event properties
 */
export function trackEvent(
    client: FrakClient | undefined,
    event: FrakEvent,
    props: EventProps = {}
): void {
    if (!client) {
        console.debug("[Frak] No client provided, skipping event tracking");
        return;
    }

    try {
        client.openPanel?.track(event, props);
    } catch (e) {
        console.debug("[Frak] Failed to track event:", event, e);
    }
}
