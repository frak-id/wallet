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
import { withBrowserLock } from "../utils/browser/withBrowserLock";
import {
    buildProofMessage,
    bytesToHex,
    encodeProof,
    hexToBytes,
} from "./canonical";
import { deriveClientId } from "./derive";
import type { ProofOp } from "./types";

const IDENTITY_KEY_LOCK_NAME = "frak-identity-key";

const CLIENT_ID_KEY = "frak-client-id";
const CLIENT_KEY_KEY = "frak-client-key";
/**
 * Set while a legacy id is waiting to be folded into the derived id that
 * replaced it. Written in the same tick as the flip, cleared only once
 * `/merge/execute` confirms — so a failed merge retries next visit instead
 * of orphaning the old id.
 */
const CLIENT_ID_LEGACY_KEY = "frak-client-id-legacy";

const SECRET_BYTES = 32;
const UNCOMPRESSED_PUBKEY_BYTES = 65;

/**
 * PKCS#8 P-256 frame, split around the scalar. `[0] parameters` is omitted and
 * `[1] publicKey` always written: WebKit hands the scalar to an X9.63 importer
 * that needs `04||X||Y||D`, cannot derive the point itself, and walks straight
 * onto the `[1]` tag without testing for it.
 */
const PKCS8_PREFIX = /* @__PURE__ */ hexToBytes(
    "308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420"
);
const PKCS8_INFIX = /* @__PURE__ */ hexToBytes("a144034200");

const PKCS8_FORMATS = { formatSec: "pkcs8", formatPub: "raw" } as const;

export function toPkcs8(
    privateKey: Uint8Array,
    publicKey: Uint8Array
): Uint8Array {
    const out = new Uint8Array(
        PKCS8_PREFIX.length +
            SECRET_BYTES +
            PKCS8_INFIX.length +
            UNCOMPRESSED_PUBKEY_BYTES
    );
    let offset = 0;
    for (const part of [PKCS8_PREFIX, privateKey, PKCS8_INFIX, publicKey]) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

type Signer = typeof pureJsP256 | typeof webCryptoP256;

/** Throwaway scalar and digest-shaped message, for the probe below only. */
const PROBE_SECRET_KEY = /* @__PURE__ */ new Uint8Array(SECRET_BYTES).fill(1);
const PROBE_MESSAGE = /* @__PURE__ */ new Uint8Array(32);

let signerPromise: Promise<Signer> | null = null;

/**
 * Sign with WebCrypto when it works, pure JS otherwise.
 *
 * `isSupported()` only probes keygen and JWK export, never the secret-key
 * import every call here goes through. So the probe signs once for real, with
 * the key encoding production uses, and any host that still refuses it falls
 * back rather than losing every proof.
 */
async function probeSigner(): Promise<Signer> {
    try {
        if (!(await webCryptoP256.isSupported())) return pureJsP256;
        const probeKey = toPkcs8(
            PROBE_SECRET_KEY,
            pureJsP256.getPublicKey(PROBE_SECRET_KEY, false)
        );
        await webCryptoP256.sign(PROBE_MESSAGE, probeKey, PKCS8_FORMATS);
        return webCryptoP256;
    } catch {
        return pureJsP256;
    }
}

function getSigner(): Promise<Signer> {
    signerPromise ??= probeSigner();
    return signerPromise;
}

function signWith(
    signer: Signer,
    message: Uint8Array,
    privateKey: Uint8Array,
    publicKey: Uint8Array
): Promise<Uint8Array> {
    if (signer === webCryptoP256) {
        const key = toPkcs8(privateKey, publicKey);
        return webCryptoP256.sign(message, key, PKCS8_FORMATS);
    }
    return Promise.resolve(
        pureJsP256.sign(message, privateKey, { prehash: true })
    );
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
 * Persist a key/id pair. A write failure (quota, disabled storage) must not
 * reach `ensureIdentityKey`'s catch: the key in hand is valid, and clearing
 * it there would leave the next visit treating a derived id as legacy.
 */
function persistIdentity(entries: [key: string, value: string][]): void {
    try {
        for (const [key, value] of entries) {
            localStorage.setItem(key, value);
        }
    } catch {}
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

    // Effectively unreachable in a real browser, but keygen throws without
    // it, and a clear error here beats that surfacing from inside the curve implementation.
    if (typeof crypto === "undefined" || !crypto.getRandomValues) {
        throw new Error(
            "[Frak SDK] crypto.getRandomValues unavailable, cannot derive a client id"
        );
    }

    // Serialised across SDK instances: two copies racing a first visit would
    // each generate a key and both write, and the loser would then sign with
    // the winner's stored key — proofs for an id it never reports.
    return withBrowserLock(IDENTITY_KEY_LOCK_NAME, loadOrCreateIdentity);
}

async function loadOrCreateIdentity(): Promise<IdentityKeyMaterial> {
    const storedId = localStorage.getItem(CLIENT_ID_KEY);

    let existingKey: Uint8Array | null;
    let privateKey: Uint8Array;
    let derivedId: string;
    // Only key load, keygen and derivation are guarded: those are the
    // failures a stored key cannot survive. Storage writes are not, and
    // must never land here.
    try {
        existingKey = loadPrivateKey();
        privateKey = existingKey ?? pureJsP256.utils.randomSecretKey();
        derivedId = await deriveClientId(publicKeyFor(privateKey));
    } catch (error) {
        localStorage.removeItem(CLIENT_KEY_KEY);
        publicKeyCache = null;
        throw error;
    }

    if (existingKey) {
        // Atomicity: the key is authoritative. A missing or mismatched
        // stored id is silently corrected, never trusted.
        if (storedId !== derivedId) {
            persistIdentity([[CLIENT_ID_KEY, derivedId]]);
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
    // Derive its provable id now, before the caller boots the iframe.
    // Record the legacy id first: if the page dies between these writes,
    // the marker is durable and the merge retries next visit — the
    // reverse order could lose it entirely.
    persistIdentity([
        ...(storedId
            ? ([[CLIENT_ID_LEGACY_KEY, storedId]] as [string, string][])
            : []),
        // Key and id together — never one without the other.
        [CLIENT_KEY_KEY, bytesToHex(privateKey)],
        [CLIENT_ID_KEY, derivedId],
    ]);

    return {
        clientId: derivedId,
        ...(storedId && { pendingLegacyId: storedId }),
    };
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

        const publicKey = publicKeyFor(privateKey);
        const signer = await getSigner();
        let sig: Uint8Array;
        try {
            sig = await signWith(signer, message, privateKey, publicKey);
        } catch (error) {
            // A probe can pass and the real call still fail; pure JS is the
            // one path with no host dependency, so never retry the probe.
            if (signer === pureJsP256) throw error;
            signerPromise = Promise.resolve(pureJsP256);
            sig = await signWith(pureJsP256, message, privateKey, publicKey);
        }

        return encodeProof({
            v: 1,
            pk: publicKey,
            ts,
            sig,
        });
    } catch {
        return null;
    }
}
