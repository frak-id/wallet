/**
 * Auth recovery signal — notifies app/guard layers when the server confirms
 * the wallet token is dead (HTTP 401 after a genuine authenticated request).
 *
 * Does NOT clear the session. The guard layer owns the response (show re-auth
 * modal, and only clear on dismiss-of-expired).
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Signal that the wallet auth token has been server-confirmed as expired/dead.
 * Called by the transport onResponse handler on 401.
 * Does not clear state — only notifies.
 */
export function notifyWalletAuthExpired(): void {
    for (const listener of listeners) {
        try {
            listener();
        } catch {
            // Individual listener errors must not prevent others from running.
        }
    }
}

/**
 * Subscribe to wallet-auth-expired events.
 * Returns an unsubscribe function.
 */
export function subscribeToWalletAuthExpired(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
