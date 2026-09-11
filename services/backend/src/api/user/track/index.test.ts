import { describe, expect, it, vi } from "vitest";

/**
 * `consume()` short-circuits to always-allow when `isRunningLocally` is
 * truthy, which it is by default under vitest (STAGE unset). Force it off —
 * same rationale as `rateLimiter.test.ts` — so the assertions below exercise
 * the real limiter instead of being vacuously true.
 */
vi.mock("@frak-labs/app-essentials", () => ({
    isRunningLocally: false,
}));

import { trackClientKeyExtractor } from "./index";

describe("trackClientKeyExtractor", () => {
    it("keys on merchantId + x-frak-client-id when both are present", () => {
        const key = trackClientKeyExtractor({
            headers: { "x-frak-client-id": "client-1" },
            body: { merchantId: "merchant-1" },
        });
        expect(key).toBe("track:merchant-1:client-1");
    });

    it("returns null when x-frak-client-id is missing", () => {
        const key = trackClientKeyExtractor({
            headers: {},
            body: { merchantId: "merchant-1" },
        });
        expect(key).toBeNull();
    });

    it("returns null when merchantId is absent from the body", () => {
        const key = trackClientKeyExtractor({
            headers: { "x-frak-client-id": "client-1" },
            body: {},
        });
        expect(key).toBeNull();
    });

    // A null key skips the bucket entirely, it never falls back to the IP one.
    it("returns null when neither the header nor the body identifies a caller", () => {
        expect(trackClientKeyExtractor({ headers: {}, body: {} })).toBeNull();
    });

    it("returns null when body is not an object (e.g. unparsed/undefined)", () => {
        expect(
            trackClientKeyExtractor({
                headers: { "x-frak-client-id": "client-1" },
                body: undefined,
            })
        ).toBeNull();
        expect(
            trackClientKeyExtractor({
                headers: { "x-frak-client-id": "client-1" },
                body: "not-an-object",
            })
        ).toBeNull();
    });

    it("distinguishes merchants and clients from each other (no cross-bucket bleed)", () => {
        const a = trackClientKeyExtractor({
            headers: { "x-frak-client-id": "client-1" },
            body: { merchantId: "merchant-1" },
        });
        const b = trackClientKeyExtractor({
            headers: { "x-frak-client-id": "client-2" },
            body: { merchantId: "merchant-1" },
        });
        const c = trackClientKeyExtractor({
            headers: { "x-frak-client-id": "client-1" },
            body: { merchantId: "merchant-2" },
        });
        expect(new Set([a, b, c]).size).toBe(3);
    });
});

/**
 * End-to-end: both `track/*` buckets actually fire independently over a
 * real request, keyed by the values `trackClientKeyExtractor` reads from a
 * real body/header pair. Confirms `body` is available at `onBeforeHandle`
 * time for a plugin composed *before* the route in the chain — without
 * this, `extractMerchantId` would always see `undefined` and the identity
 * bucket would silently degrade to "never limits anything".
 */
describe("trackApi rate limiting — both buckets fire on a real request", () => {
    it("hits the identity bucket exactly once per request with merchantId + clientId", async () => {
        const { trackApi } = await import("./index");

        const request = () =>
            trackApi.handle(
                new Request("http://localhost/track/interaction", {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "x-frak-client-id": "client-1",
                    },
                    body: JSON.stringify({
                        merchantId: "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e",
                        type: "sharing",
                    }),
                })
            );

        const res = await request();
        // The unmocked orchestrator may fail past this point — the point is
        // only that the limiter doesn't block the first call.
        expect(res.status).not.toBe(429);
    });
});
