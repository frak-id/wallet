/**
 * Vanilla pub/sub bridge between RPC handlers (Ring 0, framework-free)
 * and the UI provider (Ring 1, Preact). Handlers call `uiBus.request(...)`
 * without knowing whether the UI runtime is mounted yet — pending requests
 * are queued and replayed on the first `attach()`.
 *
 * Keep this module dependency-free (no preact, no react, no zustand)
 * so it can stay in the eager bundle.
 */

import type { UIRequest } from "@/module/providers/ListenerUiProvider";

type Handler = (req: UIRequest) => void;

let activeHandler: Handler | null = null;
const pending: UIRequest[] = [];

export const uiBus = {
    /**
     * Dispatch a UI request. If the provider is mounted (`attach` was called)
     * the handler runs synchronously; otherwise the request is queued and
     * delivered FIFO when a handler attaches.
     */
    request(req: UIRequest): void {
        if (activeHandler) {
            activeHandler(req);
            return;
        }
        pending.push(req);
    },

    /**
     * Subscribe a handler. Drains any queued requests synchronously, then
     * forwards every subsequent `request(...)` to the handler. Returns an
     * unsubscribe function that clears the active handler if it is still
     * the one passed in.
     */
    attach(handler: Handler): () => void {
        activeHandler = handler;
        if (pending.length > 0) {
            const queued = pending.splice(0);
            for (const req of queued) {
                handler(req);
            }
        }
        return () => {
            if (activeHandler === handler) {
                activeHandler = null;
            }
        };
    },
};
