/**
 * Frozen wire format for identity proof-of-possession.
 *
 * PURE module: no crypto import, no `crypto.subtle`, no `@noble/*`. This is
 * the single artifact the SDK signer and the backend verifier
 * (`IdentityProofService`) both build on, and the one native (Phase 6) must
 * reproduce byte-for-byte. Do not change anything in this file without
 * updating `docs/plans/identity-proof-of-possession/README.md` §2.3 and
 * regenerating the golden fixtures.
 *
 * Everything here is FIXED WIDTH. There are no length prefixes, no JSON and
 * no text encoding of ids, because every field has a size known at compile
 * time. A native port is a sequence of byte copies at constant offsets
 * rather than a parser.
 *
 * Signed message (§2.3), `len(op) + 72` bytes:
 *
 *   msg := op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8)
 *
 *   op          := ASCII bytes of the op string, no length prefix. Domain
 *                  separation: a signature for one op never verifies for
 *                  another. Kept as text so a hexdump is self-describing.
 *   merchantId  := the UUID's 16 raw bytes, NOT its 36-char text form. Text
 *                  would re-introduce a case-normalisation hazard: Swift's
 *                  `UUID.uuidString` is uppercase, so two platforms could
 *                  sign different bytes for the same id (README §8).
 *   binding     := op-specific, always exactly 32 bytes, zero-filled when
 *                  unused:
 *                    - `frak-merge-v1`   → SHA-256(mergeToken)
 *                    - `frak-ensure-v1`  → 32 zero bytes
 *                    - `frak-install-v1` → 32 zero bytes
 *   ts          := 8-byte unsigned big-endian, Unix SECONDS.
 *
 * Wire envelope (§2.3), 138 bytes before encoding:
 *
 *   envelope := v(1) ‖ pk(65) ‖ ts(8) ‖ sig(64)
 *   proof    := base64url(envelope), unpadded
 *
 *   v   := envelope version, 1 today. Bumping it is how any future layout
 *          change (a longer id, a different curve) is introduced: the
 *          version is the first byte, so a decoder rejects an unknown
 *          layout before reading anything it would misinterpret.
 *   pk  := uncompressed P-256 public key, 65 bytes, `0x04` prefix. Stays
 *          uncompressed so a verifier can derive the id with a plain hash
 *          and `importKey("raw", …)`, with no point decompression and
 *          therefore no curve library.
 *   sig := raw r‖s ECDSA, 64 bytes. NOT low-S normalised — see §2.3: plain
 *          ECDSA verifiers (WebCrypto, CryptoKit, Android) accept both, and
 *          the malleability low-S prevents is irrelevant here because the
 *          signature is never hashed into an identifier.
 */

import type { ProofEnvelope, ProofOp } from "./types";

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Byte widths of the fixed-size fields. */
const UUID_BYTES = 16;
const BINDING_BYTES = 32;
const TS_BYTES = 8;
const PUBKEY_BYTES = 65;
const SIG_BYTES = 64;
const ENVELOPE_BYTES = 1 + PUBKEY_BYTES + TS_BYTES + SIG_BYTES;

/** Current envelope version. Bump to introduce a new layout. */
const ENVELOPE_VERSION = 1;

const textEncoder = new TextEncoder();

/** Fields that make up the op-specific binding, before any signing happens. */
export type ProofMessageParams = {
    op: ProofOp;
    /** 36-char hyphenated UUID, any case. */
    merchantId: string;
    /** 36-char hyphenated UUID, any case. */
    anonymousId: string;
    /**
     * Op-specific binding. Empty or 32 bytes; anything else is a bug and
     * throws. Empty is written as 32 zero bytes.
     */
    binding: Uint8Array;
    /** Unix seconds. */
    ts: number;
};

/**
 * The 16 raw bytes of a hyphenated UUID string.
 *
 * Parsing rather than lowercasing is what removes the cross-platform case
 * hazard entirely: `A` and `a` parse to the same nibble, so the signed bytes
 * cannot depend on the caller's formatting.
 */
export function uuidToBytes(value: string, label: string): Uint8Array {
    if (!UUID_RE.test(value)) {
        throw new Error(`${label} must be a UUID string, got: ${value}`);
    }
    const hex = value.replace(/-/g, "");
    const out = new Uint8Array(UUID_BYTES);
    for (let i = 0; i < UUID_BYTES; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function writeUint64be(target: Uint8Array, offset: number, value: number) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`ts must be a non-negative integer: ${value}`);
    }
    let remaining = BigInt(value);
    for (let i = TS_BYTES - 1; i >= 0; i--) {
        target[offset + i] = Number(remaining & 0xffn);
        remaining >>= 8n;
    }
}

function readUint64be(source: Uint8Array, offset: number): number {
    let value = 0n;
    for (let i = 0; i < TS_BYTES; i++) {
        value = (value << 8n) | BigInt(source[offset + i]);
    }
    return Number(value);
}

/**
 * Build the exact canonical message bytes to be ECDSA-signed. Frozen —
 * see the module doc comment.
 */
export function buildProofMessage(params: ProofMessageParams): Uint8Array {
    if (
        params.binding.length !== 0 &&
        params.binding.length !== BINDING_BYTES
    ) {
        throw new Error(
            `binding must be empty or ${BINDING_BYTES} bytes, got ${params.binding.length}`
        );
    }

    const op = textEncoder.encode(params.op);
    const out = new Uint8Array(
        op.length + UUID_BYTES * 2 + BINDING_BYTES + TS_BYTES
    );

    let offset = 0;
    out.set(op, offset);
    offset += op.length;
    out.set(uuidToBytes(params.merchantId, "merchantId"), offset);
    offset += UUID_BYTES;
    out.set(uuidToBytes(params.anonymousId, "anonymousId"), offset);
    offset += UUID_BYTES;
    // Zero-filled by construction, so an empty binding needs no branch.
    out.set(params.binding, offset);
    offset += BINDING_BYTES;
    writeUint64be(out, offset, params.ts);

    return out;
}

/**
 * Derive the anonymous id from a SHA-256 digest of the uncompressed public
 * key (README §2.1). Takes the first 16 bytes, overwrites the RFC-4122
 * version (byte 6) and variant (byte 8) bits, and formats as a lowercase
 * hyphenated UUID string.
 *
 * `hash` must be the full SHA-256 digest (32 bytes); only the first 16 are
 * used. Truncation happens here so callers always pass the untruncated
 * digest and this function is the single place the RFC-4122 bits are set.
 */
export function deriveClientIdFromHash(hash: Uint8Array): string {
    if (hash.length < UUID_BYTES) {
        throw new Error(
            `deriveClientIdFromHash requires at least ${UUID_BYTES} bytes, got ${hash.length}`
        );
    }
    const bytes = hash.slice(0, UUID_BYTES);
    // RFC-4122 version 4 (bits set on byte 6) and variant (bits set on byte 8).
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytesToHex(bytes);
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join("-");
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// base64url (no padding) — the only encoding left on the wire.
// ---------------------------------------------------------------------------

export function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    // btoa is available in every browser and in Bun/Node >= 18.
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
    const padLength = (4 - (value.length % 4)) % 4;
    const base64 = value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(value.length + padLength, "=");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * `proof = base64url(v ‖ pk ‖ ts ‖ sig)`, §2.3. Single opaque blob so every
 * hop (RPC payload, URL fragment, Play referrer string) treats it as one
 * value.
 */
export function encodeProof(envelope: ProofEnvelope): string {
    if (envelope.pk.length !== PUBKEY_BYTES) {
        throw new Error(
            `pk must be ${PUBKEY_BYTES} bytes, got ${envelope.pk.length}`
        );
    }
    if (envelope.sig.length !== SIG_BYTES) {
        throw new Error(
            `sig must be ${SIG_BYTES} bytes, got ${envelope.sig.length}`
        );
    }

    const out = new Uint8Array(ENVELOPE_BYTES);
    out[0] = envelope.v;
    out.set(envelope.pk, 1);
    writeUint64be(out, 1 + PUBKEY_BYTES, envelope.ts);
    out.set(envelope.sig, 1 + PUBKEY_BYTES + TS_BYTES);

    return bytesToBase64Url(out);
}

/**
 * Decode a wire proof string. Never throws — malformed input (bad base64,
 * wrong length, unknown version) returns `null` so callers can uniformly
 * treat "no usable proof" the same way regardless of cause.
 */
export function decodeProof(wire: string): ProofEnvelope | null {
    try {
        const bytes = base64UrlToBytes(wire);
        if (bytes.length !== ENVELOPE_BYTES) return null;
        if (bytes[0] !== ENVELOPE_VERSION) return null;

        return {
            v: ENVELOPE_VERSION,
            pk: bytes.slice(1, 1 + PUBKEY_BYTES),
            ts: readUint64be(bytes, 1 + PUBKEY_BYTES),
            sig: bytes.slice(1 + PUBKEY_BYTES + TS_BYTES),
        };
    } catch {
        return null;
    }
}
