/**
 * JWT expiry utilities — hand-rolled base64url decoder, no external deps.
 *
 * Authority principle: client-decoded `exp` drives PROACTIVE RENEWAL only,
 * never destructive logout. The server 401 is the sole authority for "truly
 * dead". All helpers fail-open (return false / null) on undecodable tokens.
 */

/** ~2 hours — renew the SDK token before it lapses in a long session */
export const SDK_RENEW_BEFORE_MS = 2 * 60 * 60 * 1000;

/** 7 days — prompt wallet re-auth before the 30-day token expires */
export const WALLET_REAUTH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Decode a JWT payload without verifying the signature.
 * Returns null if the token is malformed or missing the `exp` claim.
 * JWT exp is a NumericDate (seconds since epoch); we return milliseconds.
 */
export function getTokenExpMs(token: string): number | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        // base64url → base64 → decode
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = atob(b64);
        const payload = JSON.parse(json) as Record<string, unknown>;
        const exp = payload.exp;
        if (typeof exp !== "number") return null;
        return exp * 1000; // seconds → milliseconds
    } catch {
        return null;
    }
}

/**
 * Returns true only when the token's `exp` is verifiably in the past.
 * Fail-open: returns false when exp cannot be decoded.
 *
 * @param skewMs  Positive = treat as expired `skewMs` early (clock skew guard).
 *                Only use positive skew for destructive decisions; proactive
 *                renewal uses `expiresWithinMs` with a window instead.
 */
export function isExpired(token: string, skewMs = 0): boolean {
    const expMs = getTokenExpMs(token);
    if (expMs === null) return false; // fail-open
    return Date.now() + skewMs > expMs;
}

/**
 * Returns true when the token expires within `windowMs` from now.
 * Used for proactive renewal: "should I renew soon?"
 * Fail-open: returns false when exp cannot be decoded.
 */
export function expiresWithinMs(token: string, windowMs: number): boolean {
    const expMs = getTokenExpMs(token);
    if (expMs === null) return false; // fail-open: don't renew if undecodable
    return Date.now() + windowMs > expMs;
}
