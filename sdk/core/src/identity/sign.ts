/**
 * Browser-side key material for identity proof-of-possession (README §2.3).
 *
 * The key is generated `extractable: true` and stored as a JWK in
 * `localStorage["frak-client-key"]`, next to `localStorage["frak-client-id"]`
 * (README §2.3). WebCrypto is used when available; `@noble/curves` is
 * imported dynamically, only on failure, so bundlers that can code-split
 * keep it out of the entry chunk (README §2.4). The CDN IIFE build cannot
 * split, so it pays the weight unconditionally — accepted, since §2.4
 * requires HTTP merchants to get a real provable id rather than degrading
 * to an unverifiable one.
 */

import {
    base64UrlToBytes,
    buildProofMessage,
    bytesToBase64Url,
    encodeProof,
} from "./canonical";
import { deriveClientId } from "./derive";
import type { ProofEnvelope, ProofOp } from "./types";

const CLIENT_ID_KEY = "frak-client-id";
const CLIENT_KEY_KEY = "frak-client-key";

/** A P-256 keypair, in the shape every signer implementation produces. */
type Keypair = {
    /** Uncompressed public key: 65 bytes, `0x04` prefix. */
    publicKey: Uint8Array;
    /** Signs a pre-built message and returns raw r||s, low-S normalised. */
    sign: (message: Uint8Array) => Promise<Uint8Array>;
    /** Serialises the private key as a JWK for `localStorage` persistence. */
    exportJwk: () => Promise<JsonWebKey>;
};

type Signer = {
    generate: () => Promise<Keypair>;
    importJwk: (jwk: JsonWebKey) => Promise<Keypair>;
};

let cachedSigner: Signer | null = null;

/**
 * NIST P-256 (secp256r1) group order — a public, standardised constant, not
 * key material. Hardcoded so the WebCrypto success path never needs to
 * import `@noble/curves` just for low-S normalisation: that import must
 * stay confined to the fallback path, or the "lazy" fallback chunk stops
 * being lazy (README §2.4 — verified empirically against the built CDN
 * bundle; see `docs/plans/identity-proof-of-possession/DECISIONS.md`).
 */
const P256_ORDER =
    0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const P256_HALF_ORDER = P256_ORDER / 2n;

function normalizeLowS(sig: Uint8Array): Uint8Array {
    const r = sig.slice(0, 32);
    const s = sig.slice(32, 64);
    const sBig = BigInt(
        `0x${Array.from(s, (b) => b.toString(16).padStart(2, "0")).join("")}`
    );
    if (sBig <= P256_HALF_ORDER) return sig;
    const normalized = P256_ORDER - sBig;
    const sBytes = new Uint8Array(32);
    let remaining = normalized;
    for (let i = 31; i >= 0; i--) {
        sBytes[i] = Number(remaining & 0xffn);
        remaining >>= 8n;
    }
    const out = new Uint8Array(64);
    out.set(r, 0);
    out.set(sBytes, 32);
    return out;
}

/**
 * WebCrypto P-256 signer. Does not import `@noble/curves`: raw r||s output
 * comes from WebCrypto's native P-1363 ECDSA format, and low-S
 * normalisation uses the hardcoded curve order above, not a curve library.
 */
async function webCryptoSigner(): Promise<Signer> {
    async function wrap(cryptoKeyPair: CryptoKeyPair): Promise<Keypair> {
        const rawPublicKey = await crypto.subtle.exportKey(
            "raw",
            cryptoKeyPair.publicKey
        );
        return {
            publicKey: new Uint8Array(rawPublicKey),
            sign: async (message) => {
                const signature = await crypto.subtle.sign(
                    { name: "ECDSA", hash: "SHA-256" },
                    cryptoKeyPair.privateKey,
                    message as BufferSource
                );
                // WebCrypto ECDSA already returns raw r||s (P-1363), not DER.
                return normalizeLowS(new Uint8Array(signature));
            },
            exportJwk: () =>
                crypto.subtle.exportKey(
                    "jwk",
                    cryptoKeyPair.privateKey
                ) as Promise<JsonWebKey>,
        };
    }

    return {
        generate: async () => {
            const cryptoKeyPair = (await crypto.subtle.generateKey(
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign", "verify"]
            )) as CryptoKeyPair;
            return wrap(cryptoKeyPair);
        },
        importJwk: async (jwk) => {
            const privateKey = await crypto.subtle.importKey(
                "jwk",
                jwk,
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign"]
            );
            const publicKey = await crypto.subtle.importKey(
                "jwk",
                { ...jwk, d: undefined, key_ops: ["verify"] },
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["verify"]
            );
            return wrap({ privateKey, publicKey } as CryptoKeyPair);
        },
    };
}

/**
 * Pure-JS fallback for non-secure contexts, where `crypto.subtle` is absent
 * entirely (README §2.4). `crypto.getRandomValues` is not secure-context
 * gated, so this path works there and HTTP merchants still get a real,
 * provable, derived id. Kept a dynamic `import()` so code-splitting
 * bundlers put it in a lazy chunk.
 */
async function nobleSigner(): Promise<Signer> {
    const { p256 } = await import("@noble/curves/nist.js");

    function keypairFromPrivateKey(privateKey: Uint8Array): Keypair {
        const publicKey = p256.getPublicKey(privateKey, false);
        return {
            publicKey,
            sign: async (message) =>
                p256.sign(message, privateKey, { prehash: true }),
            exportJwk: async () => privateKeyToJwk(privateKey, publicKey),
        };
    }

    return {
        generate: async () => {
            const privateKey = p256.utils.randomSecretKey();
            return keypairFromPrivateKey(privateKey);
        },
        importJwk: async (jwk) => {
            const privateKey = jwkToPrivateKeyBytes(jwk);
            return keypairFromPrivateKey(privateKey);
        },
    };
}

/** Builds the JWK the `@noble` fallback needs to round-trip through storage. */
function privateKeyToJwk(
    privateKey: Uint8Array,
    publicKey: Uint8Array
): JsonWebKey {
    return {
        kty: "EC",
        crv: "P-256",
        d: bytesToBase64Url(privateKey),
        x: bytesToBase64Url(publicKey.slice(1, 33)),
        y: bytesToBase64Url(publicKey.slice(33, 65)),
    };
}

function jwkToPrivateKeyBytes(jwk: JsonWebKey): Uint8Array {
    if (!jwk.d) {
        throw new Error("JWK has no private key material");
    }
    return base64UrlToBytes(jwk.d);
}

/**
 * Detect a usable signer by *attempting a real `generateKey`*, not by
 * checking `typeof crypto.subtle` — some embedded browsers expose the
 * object but throw on use (README §2.4). Cached so the detection only ever
 * runs once per page load.
 */
async function getSigner(): Promise<Signer> {
    if (cachedSigner) return cachedSigner;

    if (typeof crypto !== "undefined" && crypto.subtle) {
        try {
            const probe = await crypto.subtle.generateKey(
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign", "verify"]
            );
            // Not thrown: WebCrypto is usable. Discard the probe key, the
            // real signer generates its own.
            void probe;
            cachedSigner = await webCryptoSigner();
            return cachedSigner;
        } catch {
            // Some embedded browsers expose crypto.subtle but throw on use.
            // Fall through to the pure-JS fallback below.
        }
    }

    cachedSigner = await nobleSigner();
    return cachedSigner;
}

/** True if the environment can produce entropy at all (README §2.4). */
function hasEntropySource(): boolean {
    return typeof crypto !== "undefined" && !!crypto.getRandomValues;
}

export type IdentityKeyMaterial = {
    /** The anonymous id — derived and provable, or a plain legacy id. */
    clientId: string;
    /** `true` when `clientId` was cryptographically derived and can be proven. */
    derived: boolean;
};

/**
 * Mint a random, unprovable id and persist it as a legacy id (README §2.4,
 * §2.6). Reused whenever key generation is impossible or unavailable — no
 * separate code path, no extra decision to make later.
 */
function legacyFallback(): IdentityKeyMaterial {
    const clientId =
        typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                  const r = (Math.random() * 16) | 0;
                  const v = c === "x" ? r : (r & 0x3) | 0x8;
                  return v.toString(16);
              });
    if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(CLIENT_ID_KEY, clientId);
    }
    return { clientId, derived: false };
}

/**
 * Load the persisted key/id pair, generating a fresh keypair when neither
 * exists, and enforcing the §2.3 atomicity invariant: a stored id that
 * doesn't match its key is never trusted over the key. On mismatch or a
 * missing half, the key is authoritative and the id is rewritten from it;
 * if the key itself is unusable, both are regenerated together.
 *
 * Never throws. Falls back to an unprovable legacy id when no entropy
 * source exists at all.
 */
export async function ensureIdentityKey(): Promise<IdentityKeyMaterial> {
    if (typeof window === "undefined" || !window.localStorage) {
        return legacyFallback();
    }

    if (!hasEntropySource()) {
        return legacyFallback();
    }

    const storedId = localStorage.getItem(CLIENT_ID_KEY);
    const storedKeyJson = localStorage.getItem(CLIENT_KEY_KEY);

    try {
        const signer = await getSigner();

        if (storedKeyJson) {
            const jwk = JSON.parse(storedKeyJson) as JsonWebKey;
            const keypair = await signer.importJwk(jwk);
            const derivedId = await deriveClientId(keypair.publicKey);

            // §2.3 atomicity: the key is authoritative. A missing or
            // mismatched stored id is silently corrected, never trusted.
            if (storedId !== derivedId) {
                localStorage.setItem(CLIENT_ID_KEY, derivedId);
            }
            return { clientId: derivedId, derived: true };
        }

        // No key on file. A `storedId` here is a pre-existing legacy id
        // (README §2.6) — it is left untouched. The migration merge that
        // would fold it into a freshly derived id is explicitly deferred
        // (DECISIONS §3.1, divergence D6): only clients with NO existing id
        // get a derived one here.
        if (storedId) {
            return { clientId: storedId, derived: false };
        }

        const keypair = await signer.generate();
        const derivedId = await deriveClientId(keypair.publicKey);
        const jwk = await keypair.exportJwk();

        // Store key and id together (§2.3) — never one without the other.
        localStorage.setItem(CLIENT_KEY_KEY, JSON.stringify(jwk));
        localStorage.setItem(CLIENT_ID_KEY, derivedId);

        return { clientId: derivedId, derived: true };
    } catch {
        // Keygen/import failed outright (corrupt JWK, unusable signer,
        // etc). Regenerate both from scratch rather than leaving a
        // half-broken pair around.
        localStorage.removeItem(CLIENT_KEY_KEY);
        return legacyFallback();
    }
}

/**
 * Sign a proof-of-possession for the given op (README §2.2). Returns `null`
 * — never throws — when no key is available (legacy id) or signing fails
 * for any reason; callers must treat proofs as always-optional.
 */
export async function signProof(params: {
    op: ProofOp;
    merchantId: string;
    anonymousId: string;
    binding?: Uint8Array;
    ts?: number;
}): Promise<string | null> {
    if (typeof window === "undefined" || !window.localStorage) return null;

    const storedKeyJson = localStorage.getItem(CLIENT_KEY_KEY);
    if (!storedKeyJson) return null;

    try {
        const signer = await getSigner();
        const jwk = JSON.parse(storedKeyJson) as JsonWebKey;
        const keypair = await signer.importJwk(jwk);

        const ts = params.ts ?? Math.floor(Date.now() / 1000);
        const message = buildProofMessage({
            op: params.op,
            merchantId: params.merchantId,
            anonymousId: params.anonymousId,
            binding: params.binding ?? new Uint8Array(0),
            ts,
        });
        const sig = await keypair.sign(message);

        const envelope: ProofEnvelope = {
            v: 1,
            pk: keypair.publicKey,
            ts,
            sig,
        };
        return encodeProof(envelope);
    } catch {
        return null;
    }
}
