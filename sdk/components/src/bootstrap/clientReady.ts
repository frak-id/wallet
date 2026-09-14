const CUSTOM_EVENT_NAME = "frak:client";

/**
 * Dispatch a custom event when the Frak client is ready
 */
export function dispatchClientReadyEvent() {
    const event = new CustomEvent(CUSTOM_EVENT_NAME);
    window.dispatchEvent(event);
}

/**
 * Add or remove an event listener for when the Frak client is ready.
 * An `add` on an already-ready client runs the callback immediately.
 */
export function onClientReady(action: "add" | "remove", callback: () => void) {
    if (window.FrakSetup?.client && action === "add") {
        callback();
        return;
    }
    const eventHandler =
        action === "add" ? window.addEventListener : window.removeEventListener;
    eventHandler(CUSTOM_EVENT_NAME, callback, false);
}
