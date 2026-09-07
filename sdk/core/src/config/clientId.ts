/**
 * Client ID utilities for anonymous tracking.
 *
 * Every id is **derived from a P-256 keypair** and can therefore be proven.
 * There is deliberately no path that mints a random, unprovable id — that
 * would reopen the downgrade hole proof-of-possession closes.
 *
 * Derivation is inherently async (WebCrypto), so there are two accessors:
 *
 * - {@link getClientId} — synchronous, returns `undefined` until derivation
 *   has completed. Kept sync because it's public API on `window.FrakSetup.core`
 *   with consumers that cannot await (Shopify cart-attribute snippets fall
 *   back to `localStorage` on a nullish result; a `Promise` would serialise
 *   as `"[object Promise]"`). Prefer {@link getClientIdAsync} internally.
 * - {@link getClientIdAsync} — awaits derivation. First caller generates,
 *   concurrent callers join the same in-flight work.
 *
 * {@link initClientId} is the explicit warm-up used by `createIframe`, which
 * must have a real id before it can build the listener URL.
 */

import { migrateLegacyIdentity } from "../actions/migrateLegacyIdentity";
import { ensureIdentityKey } from "../identity/sign";

let cachedClientId: string | null = null;
let initPromise: Promise<string> | null = null;

/**
 * Generate/load the P-256 key and derive the anonymous id from it. Idempotent
 * — concurrent callers reuse the in-flight promise, so N calls in one tick
 * perform exactly one keygen.
 *
 * Rejects when derivation is impossible (no `crypto.getRandomValues`, no
 * `localStorage`, unusable signer) — no fallback to an unprovable id;
 * callers that must not throw use {@link getClientId} instead. The rejected
 * promise is left cached so a device that can't keygen isn't retried forever.
 *
 * When this visit migrates a pre-derivation client, the legacy id is folded
 * into the new one here. Only the local keygen/derivation is awaited — the
 * merge itself is NOT awaited, so the caller can seed the iframe with the
 * derived id immediately while the merge stays off the critical path.
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
 * yet (or failed). Synchronous, and never mints anything — any value it
 * returns is P-256-derived. On a cold cache it schedules derivation in the
 * background so a later call succeeds, without blocking or throwing.
 *
 * Prefer {@link getClientIdAsync} anywhere an `await` is possible.
 *
 * @returns The derived client ID (UUID format), or `undefined`
 */
export function getClientId(): string | undefined {
    if (cachedClientId) return cachedClientId;
    // Warm the cache for the next caller. `.catch` is required, not
    // defensive: `initClientId` can reject, and a floating rejected
    // promise would surface as an unhandled rejection on every cold read.
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
