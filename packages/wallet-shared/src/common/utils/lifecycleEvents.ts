import type { IFrameLifecycleEvent } from "@frak-labs/core-sdk";

/**
 * Emit an iframe lifecycle event
 * @param event
 */
export function emitLifecycleEvent(event: IFrameLifecycleEvent) {
    try {
        window.parent?.postMessage(event, "*");
    } catch (e) {
        console.warn("Unable to post lifecycle event", e);
    }
}
