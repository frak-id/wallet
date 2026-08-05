import { useCallback, useEffect } from "react";
import { type HostResultAction, sendHostResult } from "./bridge";

type HostBridge = {
    /**
     * Hand an outcome back to the native host. Returns `true` when the
     * hand-off happened, so callers can fall through to their web behaviour
     * when there is no host listening.
     */
    returnToHost: (action: HostResultAction) => boolean;
    /**
     * Whether a share can be handed off at all.
     *
     * `useShareLink` reports `canShare: false` in an Android WebView, where
     * `navigator.share` genuinely does not exist — without this the Share
     * button would be hidden on exactly the platform that needs the hand-off
     * most. The gate is the return scheme rather than the embedding mode: a
     * host that opened this page without one has no way to receive the ask,
     * and a button that silently does nothing is worse than one that is not
     * there.
     */
    canHandOff: boolean;
};

/**
 * The wallet side of the native host contract.
 *
 * Owns the outbound half: the `ready` ping, and the callback every outcome
 * handler funnels through. The inbound half (params) lives in `../params`.
 */
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
    // Tell the host the page has actually painted, so it can drop its loading
    // skeleton on a fact rather than a timer. Two frames: the first is
    // scheduled before this render is committed, the second cannot run until
    // after it has been painted.
    //
    // Skipped while warming — nothing is on screen for a user to be waiting
    // on, and the host has no sheet up to uncover.
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
