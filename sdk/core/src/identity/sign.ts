/**
 * Browser-side key material for identity proof-of-possession.
 *
 * The private key is 32 raw bytes, stored as hex in
 * `localStorage["frak-client-key"]` next to `localStorage["frak-client-id"]`.
 * Raw bytes rather than a JWK: both signing backends below take the same
 * 32-byte secret, so there is nothing to translate between them.
 *
 * WebCrypto signs when usable, `@noble/curves`' pure-JS implementation
 * otherwise. Both come from the same package and agree byte-for-byte on the
 * same key.
 */

import { p256 as pureJsP256 } from "@noble/curves/nist.js";
import { p256 as webCryptoP256 } from "@noble/curves/webcrypto.js";
import {
    buildProofMessage,
    bytesToHex,
    encodeProof,
    hexToBytes,
} from "./canonical";
import { deriveClientId } from "./derive";
import type { ProofOp } from "./types";

const CLIENT_ID_KEY = "frak-client-id";
const CLIENT_KEY_KEY = "frak-client-key";
/**
 * Set while a legacy id is waiting to be folded into the derived id that
 * replaced it. Written in the same tick as the flip, cleared only once
 * `/merge/execute` confirms — so a failed merge retries next visit instead
 * of orphaning the old id.
 */
const CLIENT_ID_LEGACY_KEY = "frak-client-id-legacy";

/**
 * Noble's WebCrypto wrapper defaults to PKCS8/SPKI key serialisation; we
 * hold raw 32-byte secrets and raw 65-byte public keys, so every call has to
 * say so explicitly.
 */
const RAW_FORMATS = { formatSec: "raw", formatPub: "raw" } as const;

/**
 * Sign with WebCrypto when it works, pure JS otherwise.
 *
 * `isSupported()` performs a real WebCrypto operation rather than checking
 * `typeof crypto.subtle`, which is what makes it safe on embedded browsers
 * that expose the object but throw on use. The probe is cached per page load.
 */
let signerPromise: Promise<typeof pureJsP256 | typeof webCryptoP256> | null =
    null;

function getSigner() {
    signerPromise ??= webCryptoP256
        .isSupported()
        .then((supported) => (supported ? webCryptoP256 : pureJsP256))
        .catch(() => pureJsP256);
    return signerPromise;
}

const hasLocalStorage = (): boolean =>
    typeof window !== "undefined" && Boolean(window.localStorage);

/**
 * Uncompressed public key for the stored private key.
 *
 * Deriving it is a full base-point multiplication, and every proof needs it,
 * so it is cached against the key hex it came from — a rotated or cleared key
 * misses and re-derives.
 */
let publicKeyCache: { keyHex: string; publicKey: Uint8Array } | null = null;

function publicKeyFor(privateKey: Uint8Array): Uint8Array {
    const keyHex = bytesToHex(privateKey);
    if (publicKeyCache?.keyHex === keyHex) return publicKeyCache.publicKey;

    const publicKey = pureJsP256.getPublicKey(privateKey, false);
    publicKeyCache = { keyHex, publicKey };
    return publicKey;
}

export type IdentityKeyMaterial = {
    /** The anonymous id. Always derived from the keypair, always provable. */
    clientId: string;
    /**
     * The pre-derivation id this client used until now, present only on the
     * visit that migrates it. The caller folds it into `clientId` with a
     * merge; until that succeeds it stays in `localStorage` under
     * `frak-client-id-legacy` and is re-reported on every subsequent visit.
     */
    pendingLegacyId?: string;
};

/**
 * The legacy id still waiting to be merged, if any. Read on later visits to
 * retry a migration whose merge never confirmed.
 */
export function getPendingLegacyId(): string | undefined {
    if (!hasLocalStorage()) return undefined;
    return localStorage.getItem(CLIENT_ID_LEGACY_KEY) ?? undefined;
}

/**
 * Drop the pending-migration marker once the merge has been confirmed by the
 * backend. Never called on a transient failure — that is what makes the
 * migration retry rather than silently orphan the legacy id.
 */
export function clearPendingLegacyId(): void {
    if (!hasLocalStorage()) return;
    localStorage.removeItem(CLIENT_ID_LEGACY_KEY);
}

/**
 * The stored 32-byte private key, or `null` when none is on file.
 * **Throws** on stored material that is present but unusable, so the caller
 * can clear it and regenerate rather than signing with garbage.
 */
function loadPrivateKey(): Uint8Array | null {
    const stored = localStorage.getItem(CLIENT_KEY_KEY);
    if (!stored) return null;
    if (!/^[0-9a-f]{64}$/i.test(stored)) {
        throw new Error("[Frak SDK] Corrupt client key");
    }
    return hexToBytes(stored);
}

/**
 * Load the persisted key/id pair, generating a fresh key when neither
 * exists. Enforces the atomicity invariant: a stored id that doesn't match
 * its key is never trusted over the key. On mismatch or a missing half, the
 * key is authoritative and the id is rewritten from it; if the key itself is
 * unusable, both are regenerated together.
 *
 * **Throws** when no provable id can be produced. Deliberately no unprovable
 * fallback — minting a random id would recreate the dual-tier system
 * proof-of-possession removes, and give attackers a downgrade target.
 * Callers that must not throw use `getClientId()` and handle `undefined`.
 */
export async function ensureIdentityKey(): Promise<IdentityKeyMaterial> {
    if (!hasLocalStorage()) {
        throw new Error(
            "[Frak SDK] No window/localStorage available to derive a client id"
        );
    }

    // `crypto.getRandomValues` is not secure-context gated and has shipped
    // since IE11, so this is effectively unreachable in a real browser. It
    // stays because keygen throws without it, and a clear error here beats
    // that failure surfacing from inside the curve implementation.
    if (typeof crypto === "undefined" || !crypto.getRandomValues) {
        throw new Error(
            "[Frak SDK] crypto.getRandomValues unavailable, cannot derive a client id"
        );
    }

    const storedId = localStorage.getItem(CLIENT_ID_KEY);

    try {
        const existingKey = loadPrivateKey();
        const privateKey = existingKey ?? pureJsP256.utils.randomSecretKey();
        const derivedId = await deriveClientId(publicKeyFor(privateKey));

        if (existingKey) {
            // Atomicity: the key is authoritative. A missing or mismatched
            // stored id is silently corrected, never trusted.
            if (storedId !== derivedId) {
                localStorage.setItem(CLIENT_ID_KEY, derivedId);
            }
            // Re-report a legacy id whose merge never confirmed, so the
            // caller retries it on this visit.
            const pendingLegacyId = getPendingLegacyId();
            return {
                clientId: derivedId,
                ...(pendingLegacyId && { pendingLegacyId }),
            };
        }

        // No key but an existing id ⇒ pre-derivation client being migrated.
        // Derive its provable id NOW, before the caller boots the iframe, so
        // the listener is seeded with the new id immediately. The merge that
        // folds `storedId` into `derivedId` runs afterwards, off the
        // critical path. Record the legacy id first: if the page dies
        // between these writes, the marker is already durable and the merge
        // retries next visit — the reverse order could lose it entirely.
        if (storedId) {
            localStorage.setItem(CLIENT_ID_LEGACY_KEY, storedId);
        }

        // Store key and id together — never one without the other.
        localStorage.setItem(CLIENT_KEY_KEY, bytesToHex(privateKey));
        localStorage.setItem(CLIENT_ID_KEY, derivedId);

        return {
            clientId: derivedId,
            ...(storedId && { pendingLegacyId: storedId }),
        };
    } catch (error) {
        // Keygen failed outright, or the stored key was unusable. Clear it so
        // the next visit regenerates cleanly, then rethrow — an unprovable id
        // is not an acceptable substitute.
        localStorage.removeItem(CLIENT_KEY_KEY);
        publicKeyCache = null;
        throw error;
    }
}

/**
 * Sign a proof-of-possession for the given op. Returns `null` — never
 * throws — when no key is available (legacy id) or signing fails for any
 * reason; callers must treat proofs as always-optional.
 */
export async function signProof(params: {
    op: ProofOp;
    merchantId: string;
    anonymousId: string;
    binding?: Uint8Array;
    ts?: number;
}): Promise<string | null> {
    if (!hasLocalStorage()) return null;

    try {
        const privateKey = loadPrivateKey();
        if (!privateKey) return null;

        const ts = params.ts ?? Math.floor(Date.now() / 1000);
        const message = buildProofMessage({
            op: params.op,
            merchantId: params.merchantId,
            anonymousId: params.anonymousId,
            binding: params.binding ?? new Uint8Array(0),
            ts,
        });

        const signer = await getSigner();
        const sig =
            signer === webCryptoP256
                ? await webCryptoP256.sign(message, privateKey, RAW_FORMATS)
                : pureJsP256.sign(message, privateKey, { prehash: true });

        return encodeProof({
            v: 1,
            pk: publicKeyFor(privateKey),
            ts,
            sig,
        });
    } catch {
        return null;
    }
}
