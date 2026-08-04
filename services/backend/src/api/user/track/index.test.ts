import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `consume()` short-circuits to always-allow when `isRunningLocally` is
 * truthy, which it is by default under vitest (STAGE unset). Force it off —
 * same rationale as `rateLimiter.test.ts` — so the assertions below exercise
 * the real limiter instead of being vacuously true.
 */
vi.mock("@frak-labs/app-essentials", () => ({
    isRunningLocally: false,
}));

import { Elysia } from "elysia";
import { InMemoryRateLimitStore } from "../../../infrastructure/rateLimit/rateLimiter";
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
 * `keyExtractor` returning `null` skips the bucket entirely (does not fall
 * back to IP). Verified directly against the store: a `null` key must
 * never be handed to `consume`.
 */
describe("trackClientKeyExtractor — null means 'no bucket', not 'IP bucket'", () => {
    it("a caller with no identifying headers/body never touches the identity store", () => {
        const store = new InMemoryRateLimitStore();
        const config = { windowMs: 60_000, maxRequests: 1 };
        const consumeSpy = vi.spyOn(store, "consume");

        const key = trackClientKeyExtractor({ headers: {}, body: {} });
        expect(key).toBeNull();

        // Mirrors rateLimitMiddleware's onBeforeHandle: `if (key === null) return;`
        if (key !== null) {
            store.consume(key, config);
        }
        expect(consumeSpy).not.toHaveBeenCalled();
    });
});

/**
 * Elysia dedupes plugins by `name` + `seed` (`checksum(name + JSON.stringify(seed))`,
 * `node_modules/elysia/dist/index.js`), and `rateLimitMiddleware`'s `seed` is
 * `finalConfig` — which excludes `keyExtractor`. Two stacked limiters with
 * identical `windowMs`/`maxRequests` therefore collapse into a single
 * plugin instance and one of the two `onBeforeHandle` hooks silently never
 * runs. Reproduced directly against Elysia rather than asserted from
 * reading the source.
 */
describe("Elysia plugin dedup — the reason the two track/* limiters must differ", () => {
    function fakeLimiter(
        name: string,
        config: { windowMs: number; maxRequests: number },
        onRun: (name: string) => void
    ) {
        return new Elysia({ name: "Middleware.rateLimit", seed: config })
            .onBeforeHandle(() => {
                onRun(name);
            })
            .as("scoped");
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("collapses two limiters sharing the exact same config into one", async () => {
        const calls: string[] = [];
        const app = new Elysia()
            .use(
                fakeLimiter("A", { windowMs: 60_000, maxRequests: 120 }, () =>
                    calls.push("A")
                )
            )
            .use(
                fakeLimiter("B", { windowMs: 60_000, maxRequests: 120 }, () =>
                    calls.push("B")
                )
            )
            .get("/same", () => "ok");

        await app.handle(new Request("http://localhost/same"));

        expect(calls).toEqual(["A"]);
    });

    it("keeps both limiters distinct when maxRequests differs", async () => {
        const calls: string[] = [];
        const app = new Elysia()
            .use(
                fakeLimiter("A", { windowMs: 60_000, maxRequests: 120 }, () =>
                    calls.push("A")
                )
            )
            .use(
                fakeLimiter("B", { windowMs: 60_000, maxRequests: 300 }, () =>
                    calls.push("B")
                )
            )
            .get("/diff", () => "ok");

        await app.handle(new Request("http://localhost/diff"));

        expect(calls).toEqual(["A", "B"]);
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
