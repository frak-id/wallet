/**
 * Binary codec for {@link FrakContextV2}.
 *
 * Produces a compact, URL-safe byte layout (~65% smaller than the previous
 * JSON+base64url format). See the layout below.
 *
 * ## Wire layout
 *
 * ```text
 * byte 0:          header
 *                    bits 0-3  version         (= 2)
 *                    bit  4    has_c flag
 *                    bit  5    has_w flag
 *                    bits 6-7  reserved (must be 0)
 * bytes 1..16:     merchant UUID   (16 bytes, mandatory)
 * bytes 17..20:    timestamp       (uint32 big-endian, Unix seconds)
 * bytes 21..36:    client UUID     (16 bytes, only when has_c is set)
 * bytes 37..56:    wallet address  (20 bytes, only when has_w is set)
 * ```
 *
 * Size variants (before base64url):
 * - has_c only:     37 bytes
 * - has_w only:     41 bytes
 * - has_c + has_w:  57 bytes
 *
 * V1 payloads are exactly 20 bytes (raw wallet address); the byte lengths never
 * overlap, so the outer decoder can disambiguate purely on length.
 *
 * @ignore
 */
import { type Address, bytesToHex, hexToBytes, isAddress } from "viem";
import type { FrakContextV2 } from "../types";

const VERSION_V2 = 0x02;
const VERSION_MASK = 0x0f;
const FLAG_HAS_C = 1 << 4;
const FLAG_HAS_W = 1 << 5;
const RESERVED_MASK = 0xc0;

const UUID_BYTES = 16;
const TIMESTAMP_BYTES = 4;
const ADDRESS_BYTES = 20;
const HEADER_BYTES = 1;

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strict lower-case UUID validation (RFC 4122 shape, any version/variant). */
function isUuid(value: unknown): value is string {
    return typeof value === "string" && UUID_RE.test(value);
}

/** Parse a canonical UUID string into 16 raw bytes. */
function uuidToBytes(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, "");
    const out = new Uint8Array(UUID_BYTES);
    for (let i = 0; i < UUID_BYTES; i++) {
        out[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return out;
}

/** Format 16 raw bytes as a canonical 8-4-4-4-12 UUID string. */
function bytesToUuid(bytes: Uint8Array): string {
    let hex = "";
    for (let i = 0; i < UUID_BYTES; i++) {
        hex += bytes[i].toString(16).padStart(2, "0");
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Encode a {@link FrakContextV2} into its binary wire format.
 *
 * Returns `null` when the context fails runtime validation (missing fields,
 * malformed UUIDs, timestamp outside uint32 range, invalid wallet).
 */
export function encodeFrakContextV2(ctx: FrakContextV2): Uint8Array | null {
    if (!isUuid(ctx.m)) return null;
    if (!Number.isInteger(ctx.t) || ctx.t < 0 || ctx.t > 0xff_ff_ff_ff)
        return null;

    const hasC = typeof ctx.c === "string" && ctx.c.length > 0;
    const hasW = typeof ctx.w === "string" && isAddress(ctx.w);
    if (!hasC && !hasW) return null;
    if (hasC && !isUuid(ctx.c)) return null;

    const size =
        HEADER_BYTES +
        UUID_BYTES +
        TIMESTAMP_BYTES +
        (hasC ? UUID_BYTES : 0) +
        (hasW ? ADDRESS_BYTES : 0);

    const buf = new Uint8Array(size);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let offset = 0;

    buf[offset++] =
        VERSION_V2 | (hasC ? FLAG_HAS_C : 0) | (hasW ? FLAG_HAS_W : 0);

    buf.set(uuidToBytes(ctx.m), offset);
    offset += UUID_BYTES;

    view.setUint32(offset, ctx.t, false);
    offset += TIMESTAMP_BYTES;

    if (hasC) {
        buf.set(uuidToBytes(ctx.c as string), offset);
        offset += UUID_BYTES;
    }

    if (hasW) {
        buf.set(hexToBytes(ctx.w as Address), offset);
        offset += ADDRESS_BYTES;
    }

    return buf;
}

/**
 * Decode a binary {@link FrakContextV2} payload.
 *
 * Returns `null` when:
 * - the header version nibble is not V2
 * - reserved header bits are set (guards against future-version payloads)
 * - neither flag is set (invalid: V2 must carry `c` and/or `w`)
 * - the byte length does not match the length implied by the header flags
 * - the decoded wallet does not pass `isAddress` (defense-in-depth against
 *   crafted payloads that round-trip by length but carry junk)
 */
export function decodeFrakContextV2(buf: Uint8Array): FrakContextV2 | null {
    if (buf.length < HEADER_BYTES + UUID_BYTES + TIMESTAMP_BYTES) return null;

    const header = buf[0];
    if ((header & VERSION_MASK) !== VERSION_V2) return null;
    if ((header & RESERVED_MASK) !== 0) return null;

    const hasC = (header & FLAG_HAS_C) !== 0;
    const hasW = (header & FLAG_HAS_W) !== 0;
    if (!hasC && !hasW) return null;

    const expected =
        HEADER_BYTES +
        UUID_BYTES +
        TIMESTAMP_BYTES +
        (hasC ? UUID_BYTES : 0) +
        (hasW ? ADDRESS_BYTES : 0);
    if (buf.length !== expected) return null;

    let offset = HEADER_BYTES;

    const m = bytesToUuid(buf.subarray(offset, offset + UUID_BYTES));
    offset += UUID_BYTES;

    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const t = view.getUint32(offset, false);
    offset += TIMESTAMP_BYTES;

    const out: FrakContextV2 = { v: 2, m, t };

    if (hasC) {
        out.c = bytesToUuid(buf.subarray(offset, offset + UUID_BYTES));
        offset += UUID_BYTES;
    }

    if (hasW) {
        const walletHex = bytesToHex(
            buf.subarray(offset, offset + ADDRESS_BYTES),
            { size: ADDRESS_BYTES }
        ) as Address;
        if (!isAddress(walletHex)) return null;
        out.w = walletHex;
        offset += ADDRESS_BYTES;
    }

    return out;
}

/**
 * Quick length-based probe to tell V1 (20-byte wallet address) apart from a V2
 * binary payload. Exposed so the outer decoder can branch without re-parsing.
 */
export function isV2BinaryLength(byteLength: number): boolean {
    return (
        byteLength ===
            HEADER_BYTES + UUID_BYTES + TIMESTAMP_BYTES + UUID_BYTES ||
        byteLength ===
            HEADER_BYTES + UUID_BYTES + TIMESTAMP_BYTES + ADDRESS_BYTES ||
        byteLength ===
            HEADER_BYTES +
                UUID_BYTES +
                TIMESTAMP_BYTES +
                UUID_BYTES +
                ADDRESS_BYTES
    );
}
