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

import { ensureIdentityKey } from "../identity/sign";

const CLIENT_ID_KEY = "frak-client-id";

function generateUUID(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

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
 */
export async function initClientId(): Promise<string> {
    if (cachedClientId) return cachedClientId;
    if (initPromise) return initPromise;

    initPromise = ensureIdentityKey()
        .then(({ clientId }) => {
            cachedClientId = clientId;
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
