/**
 * Client ID utilities for anonymous tracking.
 *
 * Every id this module hands out is **derived from a P-256 keypair** and can
 * therefore be proven (README §2.1). There is deliberately no path that mints
 * a random, unprovable id: a dual-tier system where some ids are provable and
 * some are not preserves the exact hole proof-of-possession closes, and gives
 * attackers an obvious downgrade target (README §2.4).
 *
 * Derivation is inherently async (WebCrypto), so there are two accessors:
 *
 * - {@link getClientId} — synchronous, returns `undefined` until derivation
 *   has completed. Kept sync because it is public API, is exposed at runtime
 *   on `window.FrakSetup.core`, and has consumers that cannot await (the
 *   Shopify cart-attribute snippets call it inside a sync function and fall
 *   back to `localStorage` on a nullish result — returning a `Promise` there
 *   would serialise as `"[object Promise]"`).
 *
 *   **Prefer `getClientIdAsync` for all internal use.** Every internal caller
 *   has been migrated to it; the one remaining sync read is `openSso`, which
 *   tries the cache first because it must reach `window.open()` in the same
 *   tick as the user gesture. Reading this accessor anywhere that *can* await
 *   silently trades correctness on a cold cache for nothing.
 * - {@link getClientIdAsync} — awaits derivation. First caller generates,
 *   concurrent callers join the same in-flight work. Needs no `setupClient`.
 *
 * {@link initClientId} remains the explicit warm-up used by `createIframe`,
 * which must have a real id before it can build the listener URL.
 */

import { migrateLegacyIdentity } from "../actions/migrateLegacyIdentity";
import { ensureIdentityKey } from "../identity/sign";

let cachedClientId: string | null = null;
let initPromise: Promise<string> | null = null;

/**
 * Generate/load the P-256 key and derive the anonymous id from it (README
 * §2.1). Idempotent — safe to call more than once; concurrent callers reuse
 * the in-flight promise, so N calls in one tick perform exactly one keygen.
 *
 * Rejects when derivation is impossible (no `crypto.getRandomValues`, no
 * `localStorage`, unusable signer). It does NOT fall back to an unprovable
 * id — callers that must not throw use {@link getClientId} and branch on
 * `undefined`.
 *
 * A rejected promise is deliberately left cached: retrying on every
 * subsequent call would spin keygen on a device that has already proven it
 * cannot do it.
 *
 * When this visit migrated a pre-derivation client (README §2.6), the legacy
 * id is folded into the new one here. Only the local keygen/derivation is
 * awaited; the merge itself is deliberately NOT awaited, so the caller can
 * seed the iframe with the derived id immediately and the two backend
 * round-trips stay off the connection-establishment path (README §2.5).
 */
export async function initClientId(): Promise<string> {
    if (cachedClientId) return cachedClientId;
    if (initPromise) return initPromise;

    initPromise = ensureIdentityKey().then(({ clientId, pendingLegacyId }) => {
        cachedClientId = clientId;
        if (pendingLegacyId) {
            void migrateLegacyIdentity({
                legacyId: pendingLegacyId,
                derivedId: clientId,
            });
        }
        return clientId;
    });

    return initPromise;
}

/**
 * The derived anonymous id, or `undefined` when derivation has not completed
 * yet (or failed).
 *
 * Synchronous, and never mints anything — any value it returns is
 * P-256-derived. On a cold cache it schedules derivation in the background so
 * that a later call succeeds; it does not block, does not throw, and does not
 * produce an unhandled rejection.
 *
 * Prefer {@link getClientIdAsync} anywhere an `await` is possible.
 *
 * @returns The derived client ID (UUID format), or `undefined`
 */
export function getClientId(): string | undefined {
    if (cachedClientId) return cachedClientId;
    // Warm the cache for the next caller. The `.catch` is required, not
    // defensive: `initClientId` can reject now that the unprovable fallback
    // is gone, and a floating rejected promise would surface as an unhandled
    // rejection on every cold read.
    void initClientId().catch(() => {});
    return undefined;
}

/**
 * The derived anonymous id, awaiting derivation when it has not run yet.
 *
 * First caller triggers key generation; concurrent callers join the same
 * in-flight derivation, so this is safe to call from anywhere without
 * coordinating on `setupClient`.
 *
 * Rejects when no provable id can be produced, so callers that genuinely
 * require one get a diagnosable failure rather than a silently unprovable id.
 */
export async function getClientIdAsync(): Promise<string> {
    if (cachedClientId) return cachedClientId;
    return initClientId();
}
