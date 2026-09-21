import { createHash, timingSafeEqual } from "node:crypto";

/** Lowercase hex SHA-256 of a UTF-8 string. */
export function sha256Hex(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Constant-time string comparison. `timingSafeEqual` throws on unequal
 * byte lengths, so those short-circuit to `false` (the length is not itself
 * a secret in any of our call sites — the compared values are fixed-width
 * hex digests or HMAC hex).
 */
export function constantTimeStringEqual(a: string, b: string): boolean {
    const aBytes = Buffer.from(a, "utf8");
    const bBytes = Buffer.from(b, "utf8");
    if (aBytes.length !== bBytes.length) return false;
    return timingSafeEqual(aBytes, bBytes);
}
