const CUSTOM_EVENT_NAME = "frakClientReady";

/**
 * Dispatch a custom event when the Frak client is ready
 */
export function dispatchClientReadyEvent() {
    const event = new CustomEvent(CUSTOM_EVENT_NAME);
    window.dispatchEvent(event);
}

/**
 * Add or remove an event listener for when the Frak client is ready
 * @param action
 * @param callback
 */
export function onClientReady(action: "add" | "remove", callback: () => void) {
    // Check if we already have a client, if yes, directly execute the callback
    if (window.FrakSetup?.client && action === "add") {
        callback();
        return;
    }
    // Add a listener for when the Frak client is ready
    const eventHandler =
        action === "add" ? window.addEventListener : window.removeEventListener;
    eventHandler(CUSTOM_EVENT_NAME, callback, false);
}
