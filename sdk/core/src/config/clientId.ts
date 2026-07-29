/**
 * Client ID utilities for anonymous tracking.
 *
 * `getClientId()` is exported public API, called from ~10 production sites,
 * and must keep its synchronous signature (README §2.1 "The async cost").
 * It reads a module-level cache populated by {@link initClientId}, which
 * does the (async, one-time-per-browser) key generation and derivation.
 *
 * `initClientId()` is called at the top of `createIframe`
 * (`utils/iframe/iframeHelper.ts`), before `iframe.src` is assigned —
 * `createIframe` is already `async` and already `await`ed in
 * `setupClient.ts`, so every other call site runs after it resolves.
 *
 * A consumer that imports a standalone action without calling `setupClient`
 * (e.g. `trackPurchaseStatus`) hits `getClientId()` with a cold cache. That
 * keeps today's behaviour: mint a random, unprovable id, treated as legacy
 * (README §2.1 edge case) — never throw, never block.
 */

import { migrateLegacyIdentity } from "../actions/migrateLegacyIdentity";
import { ensureIdentityKey, generateUUID } from "../identity/sign";

const CLIENT_ID_KEY = "frak-client-id";

/** Cold-path fallback: today's synchronous, unprovable id (§2.1 edge case). */
function coldClientId(): string {
    if (typeof window === "undefined" || !window.localStorage) {
        console.warn(
            "[Frak SDK] No Window / localStorage available to save the clientId"
        );
        return generateUUID();
    }

    let clientId = localStorage.getItem(CLIENT_ID_KEY);
    if (!clientId) {
        clientId = generateUUID();
        localStorage.setItem(CLIENT_ID_KEY, clientId);
    }
    return clientId;
}

let cachedClientId: string | null = null;
let initPromise: Promise<string> | null = null;

/**
 * Generate/load the P-256 key and derive the anonymous id from it (README
 * §2.1). Idempotent — safe to call more than once; subsequent calls reuse
 * the in-flight or resolved promise. Never throws: on any failure the
 * module cache simply stays unset and `getClientId()` falls back to the
 * cold synchronous path.
 *
 * When this visit migrated a pre-derivation client (README §2.6), the
 * legacy id is folded into the new one here. The awaited part is only the
 * local keygen/derivation; the merge itself is deliberately NOT awaited, so
 * the caller can seed the iframe with the derived id immediately and the
 * two backend round-trips stay off the connection-establishment path
 * (README §2.5, constraint 3).
 */
export async function initClientId(): Promise<string> {
    if (cachedClientId) return cachedClientId;
    if (initPromise) return initPromise;

    initPromise = ensureIdentityKey()
        .then(({ clientId, pendingLegacyId }) => {
            cachedClientId = clientId;
            if (pendingLegacyId) {
                void migrateLegacyIdentity({
                    legacyId: pendingLegacyId,
                    derivedId: clientId,
                });
            }
            return clientId;
        })
        .catch(() => coldClientId());

    return initPromise;
}

/**
 * Get the client ID, creating one if it doesn't exist.
 *
 * Synchronous by design (README §2.1) — reads the module cache populated by
 * {@link initClientId}. Falls back to the legacy synchronous path when
 * called before `initClientId` has resolved (or without `setupClient` at
 * all), which mints an unprovable id if none is stored yet.
 *
 * @returns The client ID (UUID format)
 */
export function getClientId(): string {
    if (cachedClientId) return cachedClientId;
    return coldClientId();
}
