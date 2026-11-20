import { createHmac } from "node:crypto";
import { constantTimeStringEqual } from "./crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

/** Hex HMAC-SHA256 of `${timestamp}.${body}`, Stripe's webhook signing scheme. */
export function signTimestampedBody({
    secret,
    timestamp,
    body,
}: {
    secret: string;
    timestamp: string;
    body: string;
}): string {
    return createHmac("sha256", secret)
        .update(`${timestamp}.${body}`, "utf8")
        .digest("hex");
}

/**
 * True when one of `signatures` signs the exact `body` bytes at `timestamp`,
 * and `timestamp` (unix seconds) is within `toleranceSeconds` of now.
 */
export function verifyTimestampedBody({
    secret,
    timestamp,
    body,
    signatures,
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    nowSeconds = Math.floor(Date.now() / 1000),
}: {
    secret: string;
    timestamp: string;
    body: string;
    signatures: string[];
    toleranceSeconds?: number;
    nowSeconds?: number;
}): boolean {
    if (!(secret && /^\d+$/.test(timestamp))) return false;
    if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) {
        return false;
    }
    const expected = signTimestampedBody({ secret, timestamp, body });
    return signatures.some((signature) =>
        constantTimeStringEqual(signature, expected)
    );
}
