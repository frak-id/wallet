import {
    base64UrlToBytes,
    bytesToBase64Url,
    bytesToHex,
    uuidToBytes,
} from "./canonical";

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_RE = /^[A-Za-z0-9_-]{22}$/;

/**
 * A UUID's 16 raw bytes as unpadded base64url: 22 characters instead of 36.
 *
 * @param value - Hyphenated UUID, any case
 * @returns The compact form, or `undefined` when `value` is not a UUID
 */
export function compactUuid(value: string): string | undefined {
    if (!UUID_RE.test(value)) return undefined;
    return bytesToBase64Url(uuidToBytes(value, "uuid"));
}

/**
 * Inverse of {@link compactUuid}. Only the canonical encoding round-trips, so
 * one UUID never has two accepted compact spellings.
 *
 * @param value - Candidate compact id
 * @returns The lowercase hyphenated UUID, or `undefined` when `value` is not a compact id
 */
export function expandCompactUuid(value: string): string | undefined {
    if (!COMPACT_RE.test(value)) return undefined;
    const bytes = base64UrlToBytes(value);
    if (bytesToBase64Url(bytes) !== value) return undefined;
    const hex = bytesToHex(bytes);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
