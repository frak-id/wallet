import { Base64 } from "ox";

/**
 * Convert an ArrayBuffer to a base64url-encoded string
 */
export function bufferToBase64URLString(
    buffer: ArrayBuffer | Uint8Array
): string {
    return bytesToBase64URLString(new Uint8Array(buffer));
}

/**
 * Convert an Uint8Array to a base64url-encoded string
 */
export function bytesToBase64URLString(bytes: Uint8Array): string {
    return Base64.fromBytes(bytes, { url: true, pad: false });
}

/**
 * Convert a base64url-encoded string to an ArrayBuffer
 */
export function base64URLStringToBuffer(base64url: string): ArrayBuffer {
    const bytes = Base64.toBytes(base64url);
    // `ox`'s decoder over-allocates its backing buffer (rounds up to a
    // multiple of 3 decoded bytes) and returns a bounded view over it, so
    // `bytes.buffer` itself can be longer than `bytes` — slice explicitly
    // rather than handing out the raw (possibly padded) backing buffer.
    // `Uint8Array.buffer` is typed as `ArrayBufferLike` (it also covers
    // `SharedArrayBuffer`-backed views); `ox` always allocates a plain
    // `ArrayBuffer` here, so the cast is safe.
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}
