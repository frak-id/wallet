import { sha256 } from "@oslojs/crypto/sha2";
import { constantTimeEqual } from "@oslojs/crypto/subtle";
import { encodeHexLowerCase } from "@oslojs/encoding";

/** Lowercase hex SHA-256 of a UTF-8 string. */
export function sha256Hex(input: string): string {
    return encodeHexLowerCase(sha256(new TextEncoder().encode(input)));
}

/**
 * Constant-time string comparison. oslojs' `constantTimeEqual` asserts
 * equal-length byte inputs, so unequal lengths short-circuit to `false`
 * (the length is not itself a secret in any of our call sites — the compared
 * values are fixed-width hex digests or HMAC hex).
 */
export function constantTimeStringEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return constantTimeEqual(
        new TextEncoder().encode(a),
        new TextEncoder().encode(b)
    );
}
