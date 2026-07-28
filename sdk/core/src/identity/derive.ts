/**
 * Anonymous id derivation (README §2.1): `deriveClientId` hashes the
 * uncompressed public key with SHA-256 and hands the digest to
 * `deriveClientIdFromHash` (the pure, frozen part in `canonical.ts`).
 *
 * Uses WebCrypto when available (every browser, and native under Bun/Node)
 * and falls back to `@noble/curves`' bundled SHA-256 only when it isn't —
 * imported lazily so the common path never pays for the fallback chunk.
 */

import { deriveClientIdFromHash } from "./canonical";

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
        try {
            const digest = await crypto.subtle.digest(
                "SHA-256",
                bytes as BufferSource
            );
            return new Uint8Array(digest);
        } catch {
            // Some embedded browsers expose `crypto.subtle` but throw on
            // use — fall through to the pure-JS path below.
        }
    }

    // Lazy: only reached when WebCrypto is unavailable or unusable, e.g. a
    // non-secure-context (plain HTTP) merchant site (README §2.4).
    const { sha256: nobleSha256 } = await import("@noble/hashes/sha2.js");
    return nobleSha256(bytes);
}

/**
 * Derive the anonymous client id from an uncompressed P-256 public key
 * (65 bytes, `0x04` prefix).
 */
export async function deriveClientId(
    pubkeyUncompressed: Uint8Array
): Promise<string> {
    const hash = await sha256(pubkeyUncompressed);
    return deriveClientIdFromHash(hash);
}
