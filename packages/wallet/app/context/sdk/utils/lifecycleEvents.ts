import type { IFrameLifecycleEvent } from "@frak-labs/nexus-sdk/core";

/**
 * Emit an iframe lifecycle event
 * @param event
 */
export function emitLifecycleEvent(event: IFrameLifecycleEvent) {
    window.parent?.postMessage(event, "*");
}
