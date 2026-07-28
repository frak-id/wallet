/**
 * Frozen wire format for identity proof-of-possession.
 *
 * PURE module: no crypto import, no `crypto.subtle`, no `@noble/*`. This is
 * the single artifact `sign.ts` (browser) and `verify.ts` (backend) both
 * build on, and the one native (Phase 6) must reproduce byte-for-byte. Do
 * not change anything in this file without updating
 * `docs/plans/identity-proof-of-possession/README.md` §2.3 and regenerating
 * the golden fixtures — this layout is frozen before native SDKs branch.
 *
 * Byte layout (README §2.3):
 *
 *   msg := prefix ‖ field(merchantId) ‖ field(anonymousId) ‖ field(binding) ‖ uint64be(ts)
 *
 *   prefix       := ASCII bytes of the op string, no length prefix, no separator
 *   field(x)     := uint16be(byteLength(x)) ‖ x
 *   uint64be(ts) := 8-byte unsigned, big-endian, Unix SECONDS, fixed width,
 *                   NOT length-prefixed (its width is already fixed)
 */

import type { ProofEnvelope, ProofOp } from "./types";

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const textEncoder = new TextEncoder();

/** Fields that make up the op-specific binding, before any signing happens. */
export type ProofMessageParams = {
    op: ProofOp;
    /** Lowercase or uppercase 36-char hyphenated UUID string; normalised here. */
    merchantId: string;
    /** Lowercase or uppercase 36-char hyphenated UUID string; normalised here. */
    anonymousId: string;
    /**
     * Op-specific binding, always present in the wire message, zero-length
     * where unused (§2.3):
     *  - `frak-merge-v1`   → 32 raw bytes of SHA-256(mergeToken)
     *  - `frak-ensure-v1`  → empty
     *  - `frak-install-v1` → empty
     */
    binding: Uint8Array;
    /** Unix seconds. */
    ts: number;
};

/**
 * Normalise a UUID string to the canonical lowercase form the signed
 * message covers. Swift's `UUID.uuidString` is uppercase — an uppercase
 * variant of the same logical id must produce the same message bytes, or
 * cross-platform signatures silently diverge (README §8).
 */
export function normalizeUuid(id: string): string {
    return id.toLowerCase();
}

function assertUuid(value: string, label: string): string {
    const normalized = normalizeUuid(value);
    if (!UUID_RE.test(normalized)) {
        throw new Error(`${label} must be a UUID string, got: ${value}`);
    }
    return normalized;
}

function writeUint16be(value: number): Uint8Array {
    if (value < 0 || value > 0xffff) {
        throw new Error(`uint16be overflow: ${value}`);
    }
    return new Uint8Array([(value >>> 8) & 0xff, value & 0xff]);
}

function writeUint64be(value: number): Uint8Array {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`uint64be must be a non-negative integer: ${value}`);
    }
    const bytes = new Uint8Array(8);
    let remaining = BigInt(value);
    for (let i = 7; i >= 0; i--) {
        bytes[i] = Number(remaining & 0xffn);
        remaining >>= 8n;
    }
    return bytes;
}

/** `uint16be(byteLength(x)) ‖ x`, per §2.3. */
function field(bytes: Uint8Array): Uint8Array {
    const out = new Uint8Array(2 + bytes.length);
    out.set(writeUint16be(bytes.length), 0);
    out.set(bytes, 2);
    return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}

/**
 * Build the exact canonical message bytes to be ECDSA-signed. Frozen —
 * see the module doc comment.
 */
export function buildProofMessage(params: ProofMessageParams): Uint8Array {
    const merchantId = assertUuid(params.merchantId, "merchantId");
    const anonymousId = assertUuid(params.anonymousId, "anonymousId");

    return concatBytes([
        textEncoder.encode(params.op),
        field(textEncoder.encode(merchantId)),
        field(textEncoder.encode(anonymousId)),
        field(params.binding),
        writeUint64be(params.ts),
    ]);
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
    if (hash.length < 16) {
        throw new Error(
            `deriveClientIdFromHash requires at least 16 bytes, got ${hash.length}`
        );
    }
    const bytes = hash.slice(0, 16);
    // RFC-4122 version 4 (bits set on byte 6) and variant (bits set on byte 8).
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
        ""
    );
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join("-");
}

// ---------------------------------------------------------------------------
// base64url (no padding) — used both for raw byte fields inside the proof
// envelope JSON and for the outer envelope encoding itself.
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    // btoa is available in every browser and in Bun/Node >= 18.
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
    return bytesToBase64(bytes)
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
    return base64ToBytes(base64);
}

function stringToBase64Url(value: string): string {
    return bytesToBase64Url(textEncoder.encode(value));
}

function base64UrlToString(value: string): string {
    return new TextDecoder().decode(base64UrlToBytes(value));
}

/**
 * Wire representation of a decoded envelope: `pk`/`sig` as base64url
 * strings (JSON cannot hold raw bytes), `ts` as a JSON number.
 */
type ProofEnvelopeJson = {
    v: 1;
    pk: string;
    ts: number;
    sig: string;
};

/**
 * `proof = base64url(JSON({ v: 1, pk, ts, sig }))`, §2.3. Single opaque blob
 * so every hop (RPC payload, URL fragment, Play referrer string) treats it
 * as one value.
 */
export function encodeProof(envelope: ProofEnvelope): string {
    const json: ProofEnvelopeJson = {
        v: envelope.v,
        pk: bytesToBase64Url(envelope.pk),
        ts: envelope.ts,
        sig: bytesToBase64Url(envelope.sig),
    };
    return stringToBase64Url(JSON.stringify(json));
}

/**
 * Decode a wire proof string. Never throws — malformed input (bad base64,
 * bad JSON, wrong shape, wrong version) returns `null` so callers can
 * uniformly treat "no usable proof" the same way regardless of cause.
 */
export function decodeProof(wire: string): ProofEnvelope | null {
    try {
        const json = JSON.parse(base64UrlToString(wire)) as unknown;
        if (!isProofEnvelopeJson(json)) {
            return null;
        }
        return {
            v: 1,
            pk: base64UrlToBytes(json.pk),
            ts: json.ts,
            sig: base64UrlToBytes(json.sig),
        };
    } catch {
        return null;
    }
}

function isProofEnvelopeJson(value: unknown): value is ProofEnvelopeJson {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
        candidate.v === 1 &&
        typeof candidate.pk === "string" &&
        typeof candidate.sig === "string" &&
        typeof candidate.ts === "number" &&
        Number.isFinite(candidate.ts)
    );
}
