/**
 * Anonymous id derivation (README §2.1): hash the uncompressed public key
 * with SHA-256 and hand the digest to `deriveClientIdFromHash` (the pure,
 * frozen part in `canonical.ts`).
 *
 * Uses `@noble/hashes` unconditionally rather than WebCrypto: it is already
 * in the bundle for the §2.4 signing fallback, it is synchronous, and it
 * works in non-secure contexts where `crypto.subtle` is absent — so a second
 * code path would buy nothing.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { deriveClientIdFromHash } from "./canonical";

/**
 * Derive the anonymous client id from an uncompressed P-256 public key
 * (65 bytes, `0x04` prefix).
 */
export async function deriveClientId(
    pubkeyUncompressed: Uint8Array
): Promise<string> {
    return deriveClientIdFromHash(sha256(pubkeyUncompressed));
}
