import { describe, expect, it } from "vitest";
import {
    expiresWithinMs,
    getTokenExpMs,
    isExpired,
    SDK_RENEW_BEFORE_MS,
    WALLET_REAUTH_BEFORE_MS,
} from "./tokenExpiry";

/**
 * Build a minimal unsigned JWT with the given payload.
 * The signature segment is omitted (not verified client-side).
 */
function makeJwt(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    const body = btoa(JSON.stringify(payload))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    return `${header}.${body}.sig`;
}

describe("getTokenExpMs", () => {
    it("returns exp in milliseconds for a valid JWT", () => {
        const expSec = Math.floor(Date.now() / 1000) + 3600; // 1h from now
        const jwt = makeJwt({ sub: "test", exp: expSec });
        expect(getTokenExpMs(jwt)).toBe(expSec * 1000);
    });

    it("returns null when exp is missing from payload", () => {
        const jwt = makeJwt({ sub: "test" });
        expect(getTokenExpMs(jwt)).toBeNull();
    });

    it("returns null for a malformed token (wrong segment count)", () => {
        expect(getTokenExpMs("not.a.jwt.extra")).toBeNull();
        expect(getTokenExpMs("onlyone")).toBeNull();
    });

    it("returns null for an empty string", () => {
        expect(getTokenExpMs("")).toBeNull();
    });

    it("returns null when payload is not valid JSON", () => {
        const bad = `header.${btoa("not-json")}.sig`;
        expect(getTokenExpMs(bad)).toBeNull();
    });

    it("returns null when exp is not a number", () => {
        const jwt = makeJwt({ exp: "not-a-number" });
        expect(getTokenExpMs(jwt)).toBeNull();
    });
});

describe("isExpired", () => {
    it("returns false for a token with future exp", () => {
        const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
        expect(isExpired(jwt)).toBe(false);
    });

    it("returns true for a token with past exp", () => {
        const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) - 1 });
        expect(isExpired(jwt)).toBe(true);
    });

    it("fails open (returns false) when exp is undecodable", () => {
        expect(isExpired("garbage")).toBe(false);
    });

    it("respects positive skewMs — treats token as expired early", () => {
        // exp is 30s in the future, but skew is 60s → should appear expired
        const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 30 });
        expect(isExpired(jwt, 60_000)).toBe(true);
    });

    it("skewMs=0 does not expire a token that has time left", () => {
        const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 120 });
        expect(isExpired(jwt, 0)).toBe(false);
    });
});

describe("expiresWithinMs", () => {
    it("returns true when token expires within the window", () => {
        // Expires in 30 min; window is 2h
        const jwt = makeJwt({
            exp: Math.floor(Date.now() / 1000) + 30 * 60,
        });
        expect(expiresWithinMs(jwt, 2 * 60 * 60 * 1000)).toBe(true);
    });

    it("returns false when token expires outside the window", () => {
        // Expires in 5h; window is 2h
        const jwt = makeJwt({
            exp: Math.floor(Date.now() / 1000) + 5 * 60 * 60,
        });
        expect(expiresWithinMs(jwt, 2 * 60 * 60 * 1000)).toBe(false);
    });

    it("fails open (returns false) when exp is undecodable", () => {
        expect(expiresWithinMs("garbage", 1_000_000)).toBe(false);
    });

    it("returns true for already-expired tokens", () => {
        const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
        expect(expiresWithinMs(jwt, 1000)).toBe(true);
    });
});

describe("constants", () => {
    it("SDK_RENEW_BEFORE_MS is approximately 2 hours", () => {
        expect(SDK_RENEW_BEFORE_MS).toBe(2 * 60 * 60 * 1000);
    });

    it("WALLET_REAUTH_BEFORE_MS is approximately 7 days", () => {
        expect(WALLET_REAUTH_BEFORE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
});
