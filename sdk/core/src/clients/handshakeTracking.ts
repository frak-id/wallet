import type {
    SdkHandshakeTimeoutContext,
    SdkLifecycleEventMap,
} from "../utils/analytics/events/lifecycle";
import {
    getIframeBootObservation,
    stopIframeBootObservation,
} from "../utils/iframe/iframeBoot";

/** The SDK stops polling the listener, and reports a timeout, after this. */
export const HANDSHAKE_TIMEOUT_MS = 30_000;

type TrackLifecycle = <E extends keyof SdkLifecycleEventMap>(
    event: E,
    properties: SdkLifecycleEventMap[E]
) => void;

/**
 * Report the handshake outcome once, plus a late `connected` if the
 * listener answers after the timeout was already reported.
 * @ignore
 */
export function trackHandshake({
    track,
    isConnected,
    iframe,
    startedAt,
}: {
    track: TrackLifecycle;
    isConnected: Promise<boolean>;
    iframe: HTMLIFrameElement;
    startedAt: number;
}): void {
    let timedOut = false;
    let settled = false;
    let wasHidden = document.visibilityState === "hidden";
    const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") wasHidden = true;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const stopWatching = () => {
        clearTimeout(timeoutHandle);
        document.removeEventListener("visibilitychange", onVisibilityChange);
    };

    const timeoutHandle = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        stopWatching();
        track("sdk_iframe_handshake_failed", {
            reason: "timeout",
            ...describeTimeout(iframe, wasHidden),
        });
        stopIframeBootObservation(iframe);
    }, HANDSHAKE_TIMEOUT_MS);

    isConnected
        .then(() => {
            if (settled) return;
            settled = true;
            stopWatching();
            track("sdk_iframe_connected", {
                handshake_duration_ms: Date.now() - startedAt,
                ...(timedOut && { after_timeout: true }),
            });
        })
        .catch(() => {
            if (settled || timedOut) return;
            settled = true;
            stopWatching();
            track("sdk_iframe_handshake_failed", { reason: "unknown" });
        });
}

function describeTimeout(
    iframe: HTMLIFrameElement,
    wasHidden: boolean
): SdkHandshakeTimeoutContext {
    const boot = getIframeBootObservation(iframe);
    return {
        visibility_state: document.visibilityState,
        was_hidden: wasHidden,
        online: navigator.onLine,
        ...(boot && {
            listener_seen: boot.listenerSeen,
            ...(boot.bootError && { listener_error: boot.bootError }),
            ...(boot.loadedAt !== undefined && {
                iframe_load_ms: boot.loadedAt - boot.createdAt,
            }),
        }),
    };
}
