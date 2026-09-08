import type { IFrameLifecycleEvent } from "@frak-labs/core-sdk";

/**
 * Emit an iframe lifecycle event
 * @param event
 * @param options
 * @param options.targetOrigin - Origin the parent must have for the browser to
 *   deliver the message. Events carrying session material, tokens, or a
 *   redirect URL MUST pass the resolved merchant origin so delivery fails
 *   closed when the parent is not it; `"*"` is for chrome events only.
 * @param options.includeUserActivation - When true, delegates the current
 *   user activation (transient activation from a click) to the parent window.
 *   Required for the parent to call activation-gated APIs like window.open().
 *   Supported in Safari 16.4+, Chrome 100+, Firefox 109+.
 */
export function emitLifecycleEvent(
    event: IFrameLifecycleEvent,
    options: { targetOrigin: string; includeUserActivation?: boolean }
) {
    const { targetOrigin } = options;
    try {
        if (options.includeUserActivation) {
            window.parent?.postMessage(event, {
                targetOrigin,
                includeUserActivation: true,
            } as WindowPostMessageOptions);
        } else {
            window.parent?.postMessage(event, targetOrigin);
        }
    } catch (e) {
        console.warn("Unable to post lifecycle event", e);
    }
}
