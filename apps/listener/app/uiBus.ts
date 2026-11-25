/**
 * Vanilla pub/sub bridge between RPC handlers (Ring 0, framework-free)
 * and the UI provider (Ring 1, Preact). Handlers call `uiBus.request(...)`
 * without knowing whether the UI runtime is mounted yet — pending requests
 * are queued and replayed on the first `attach()`.
 *
 * Keep this module dependency-free (no preact, no react, no zustand)
 * so it can stay in the eager bundle.
 */

import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import type { UIRequest } from "@/ui/ListenerUiProvider";

type Handler = (req: UIRequest) => void;

const SUPERSEDED_MESSAGE = "New request superseded previous request";

export const supersededError = () =>
    new FrakRpcError(RpcErrorCodes.internalError, SUPERSEDED_MESSAGE);

let activeHandler: Handler | null = null;
const pending: UIRequest[] = [];
let lastRequest: UIRequest | null = null;
let latestClaim: object | null = null;

export const uiBus = {
    /**
     * Mark the caller as the newest request of any type. The returned check
     * turns false once a later `claim()` happens; nothing is settled here.
     */
    claim(): () => boolean {
        const token = {};
        latestClaim = token;
        return () => latestClaim === token;
    },

    /**
     * Dispatch a UI request. If the provider is mounted (`attach` was called)
     * the handler runs synchronously; otherwise the request is queued and
     * delivered FIFO when a handler attaches.
     */
    request(req: UIRequest): void {
        // A request already settled ignores this, so handlers keep their own errors.
        if (lastRequest && lastRequest !== req) {
            void lastRequest.emitter({
                error: {
                    code: RpcErrorCodes.internalError,
                    message: SUPERSEDED_MESSAGE,
                },
            });
        }
        lastRequest = req;
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
