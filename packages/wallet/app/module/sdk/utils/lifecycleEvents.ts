import { type IFrameLifecycleEvent, encodeJson } from "@frak-labs/core-sdk";

/**
 * Emit an iframe lifecycle event
 * @param event
 */
export function emitLifecycleEvent(event: IFrameLifecycleEvent) {
    window.parent?.postMessage(encodeJson(event), "*");
}
