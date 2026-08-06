import { useCallback, useEffect } from "react";
import { type HostResultAction, sendHostResult } from "./bridge";

type HostBridge = {
    /** Returns `true` when the hand-off happened, so callers can fall back to web behaviour. */
    returnToHost: (action: HostResultAction) => boolean;
    /** Gated on the return scheme: without one the host has no way to receive the ask. */
    canHandOff: boolean;
};

/** The outbound half of the native host contract: the `ready` ping and the outcome callback. */
export function useHostBridge({
    returnScheme,
    sid,
    warm,
}: {
    returnScheme?: string;
    sid?: string;
    /** A warm page is not on screen, so it has nothing to report as ready. */
    warm: boolean;
}): HostBridge {
    // Two frames, so the host drops its loading skeleton once the page has
    // really painted. Skipped while warming: nothing is on screen yet.
    useEffect(() => {
        if (warm || !returnScheme) return;
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => {
                sendHostResult({ scheme: returnScheme, action: "ready", sid });
            });
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [warm, returnScheme, sid]);

    const returnToHost = useCallback(
        (action: HostResultAction) =>
            sendHostResult({ scheme: returnScheme, action, sid }),
        [returnScheme, sid]
    );

    return { returnToHost, canHandOff: !!returnScheme };
}
