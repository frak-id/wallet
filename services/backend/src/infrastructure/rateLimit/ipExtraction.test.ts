import { afterEach, describe, expect, it } from "vitest";
import { getClientIp } from "./ipExtraction";

const ENV_KEY = "RATE_LIMIT_TRUSTED_PROXY_HOPS";

describe("getClientIp", () => {
    const originalEnv = process.env[ENV_KEY];

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env[ENV_KEY];
        } else {
            process.env[ENV_KEY] = originalEnv;
        }
    });

    it("ignores a spoofed left-most x-forwarded-for entry (default 1 trusted hop)", () => {
        // Attacker prepends a fake IP; nginx (the single trusted proxy)
        // appends the real client IP it observed as the right-most entry.
        const ip = getClientIp({
            headers: {
                "x-forwarded-for": "1.2.3.4, 203.0.113.9",
            },
        });
        expect(ip).toBe("203.0.113.9");
    });

    it("ignores an attacker rotating many spoofed left-most entries", () => {
        const ip = getClientIp({
            headers: {
                "x-forwarded-for":
                    "9.9.9.9, 8.8.8.8, 7.7.7.7, 6.6.6.6, 203.0.113.9",
            },
        });
        expect(ip).toBe("203.0.113.9");
    });

    it("returns distinct client IPs for distinct requests (no bucket collapsing)", () => {
        const clientA = getClientIp({
            headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" },
        });
        const clientB = getClientIp({
            headers: { "x-forwarded-for": "5.6.7.8, 198.51.100.42" },
        });
        expect(clientA).toBe("203.0.113.9");
        expect(clientB).toBe("198.51.100.42");
        expect(clientA).not.toBe(clientB);
    });

    it("honors RATE_LIMIT_TRUSTED_PROXY_HOPS=2 for a clean two-hop request", () => {
        process.env[ENV_KEY] = "2";
        // Client sent no header: hop1 appends the client IP, hop2 appends
        // hop1's IP => exactly two entries, real client is the left-most.
        const ip = getClientIp({
            headers: {
                "x-forwarded-for": "203.0.113.9, 10.0.0.1",
            },
        });
        expect(ip).toBe("203.0.113.9");
    });

    it("ignores a spoofed prefix with RATE_LIMIT_TRUSTED_PROXY_HOPS=2", () => {
        process.env[ENV_KEY] = "2";
        // Client spoofed "6.6.6.6"; the two trusted hops still append the
        // real observed IPs, so the client sits at index length-2.
        const ip = getClientIp({
            headers: {
                "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.1",
            },
        });
        expect(ip).toBe("203.0.113.9");
    });

    it("fails safe to the socket peer when the header has fewer entries than trusted hops", () => {
        process.env[ENV_KEY] = "2";
        // Only one entry but two trusted hops expected (misconfig / dropped
        // header): must NOT trust the lone client-controlled entry.
        const request = new Request("https://example.com");
        const ip = getClientIp({
            request,
            headers: { "x-forwarded-for": "6.6.6.6" },
            server: { requestIP: () => ({ address: "198.51.100.7" }) },
        });
        expect(ip).toBe("198.51.100.7");
    });

    it("falls back to server.requestIP() when there is no x-forwarded-for header", () => {
        const request = new Request("https://example.com");
        const ip = getClientIp({
            request,
            headers: {},
            server: {
                requestIP: () => ({ address: "198.51.100.7" }),
            },
        });
        expect(ip).toBe("198.51.100.7");
    });

    it("falls back to remoteAddress when there is no x-forwarded-for and no server", () => {
        const ip = getClientIp({
            headers: {},
            remoteAddress: "198.51.100.8",
        });
        expect(ip).toBe("198.51.100.8");
    });

    it("returns null for empty/malformed input with no fallback available", () => {
        expect(getClientIp({ headers: {} })).toBeNull();
        expect(getClientIp({ headers: { "x-forwarded-for": "" } })).toBeNull();
        expect(
            getClientIp({ headers: { "x-forwarded-for": " , , " } })
        ).toBeNull();
    });

    it("does not trust unrelated vendor headers (no Cloudflare/Fastly in front of this deployment)", () => {
        const ip = getClientIp({
            headers: {
                "cf-connecting-ip": "6.6.6.6",
                "true-client-ip": "6.6.6.6",
                "x-real-ip": "6.6.6.6",
            },
            remoteAddress: "198.51.100.9",
        });
        expect(ip).toBe("198.51.100.9");
    });

    it("works with a Headers instance", () => {
        const headers = new Headers({
            "x-forwarded-for": "1.2.3.4, 203.0.113.9",
        });
        const ip = getClientIp({ headers });
        expect(ip).toBe("203.0.113.9");
    });
});
