import type { FrakClient } from "../types";

export type FrakEvent =
    | "share_button_clicked"
    | "wallet_button_clicked"
    | "share_modal_error"
    | "user_referred";

type EventProps = Record<string, unknown>;

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
