import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `consume()` short-circuits to always-allow when `isRunningLocally` is truthy.
 * That flag is derived from `process.env.STAGE` and defaults to `true` whenever
 * STAGE is unset (as it is under vitest), which would disable the limiter and
 * make every assertion below vacuous. Force it off so the tests exercise the
 * real sliding-window algorithm regardless of the ambient environment.
 */
vi.mock("@frak-labs/app-essentials", () => ({
    isRunningLocally: false,
}));

import { InMemoryRateLimitStore, rateLimitMiddleware } from "./rateLimiter";

describe("InMemoryRateLimitStore", () => {
    const config = { windowMs: 60_000, maxRequests: 10 };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function mockNow(ts: number) {
        vi.spyOn(Date, "now").mockReturnValue(ts);
    }

    it("allows up to maxRequests within a single sub-window", () => {
        const store = new InMemoryRateLimitStore();
        mockNow(0);
        for (let i = 0; i < 10; i++) {
            expect(store.consume("k", config)).toBe(true);
        }
        expect(store.consume("k", config)).toBe(false);
    });

    it("does not allow ~2x maxRequests across a sub-window boundary (the fixed-window bug)", () => {
        const store = new InMemoryRateLimitStore();

        // Fill the sub-window anchored at t=0 (spans [0, 60_000)).
        mockNow(0);
        for (let i = 0; i < 10; i++) {
            expect(store.consume("k", config)).toBe(true);
        }

        // At the true boundary a fixed window would reset the bucket to 0
        // and allow 10 more. The sliding counter still carries the prior
        // window at full weight here, so it must reject. (A fixed-window
        // impl returns true here — this is what discriminates the fix.)
        mockNow(60_000);
        expect(store.consume("k", config)).toBe(false);
    });

    it("gradually admits new requests as the previous sub-window's weight decays", () => {
        const store = new InMemoryRateLimitStore();

        mockNow(0);
        for (let i = 0; i < 10; i++) {
            store.consume("k", config);
        }

        // Halfway through the next window: previous window contributes ~50%
        // weight (~5 effective). 5 more requests fit exactly under the cap
        // of 10 (5 + 5 effective previous = 10, and the check is `<=`); a
        // 6th pushes the effective count to 11 and is rejected.
        mockNow(90_000);
        for (let i = 0; i < 5; i++) {
            expect(store.consume("k", config)).toBe(true);
        }
        expect(store.consume("k", config)).toBe(false);
    });

    it("fully resets once the previous window's weight has completely decayed", () => {
        const store = new InMemoryRateLimitStore();

        mockNow(0);
        for (let i = 0; i < 10; i++) {
            store.consume("k", config);
        }

        // Two full windows later, nothing carries over.
        mockNow(120_001);
        for (let i = 0; i < 10; i++) {
            expect(store.consume("k", config)).toBe(true);
        }
        expect(store.consume("k", config)).toBe(false);
    });

    it("tracks distinct keys independently", () => {
        const store = new InMemoryRateLimitStore();
        mockNow(0);
        for (let i = 0; i < 10; i++) {
            store.consume("a", config);
        }
        expect(store.consume("a", config)).toBe(false);
        expect(store.consume("b", config)).toBe(true);
    });

    it("getRemaining reflects the effective (sliding) count, not just the current sub-window", () => {
        const store = new InMemoryRateLimitStore();

        mockNow(0);
        for (let i = 0; i < 10; i++) {
            store.consume("k", config);
        }
        expect(store.getRemaining("k", config)).toBe(0);

        // Halfway into the next window, previous window still weighs ~50%.
        mockNow(90_000);
        expect(store.getRemaining("k", config)).toBeLessThan(10);
        expect(store.getRemaining("k", config)).toBeGreaterThan(0);
    });

    it("purgeExpired only evicts entries with zero residual weight (>= 2x windowMs)", () => {
        const store = new InMemoryRateLimitStore();

        mockNow(0);
        store.consume("stale", config);

        mockNow(70_000);
        store.consume("fresh", config);

        store.purgeExpired();

        // "stale" is only one windowMs behind (70s < 2*60s): its un-rolled
        // currentCount still carries weight, so it must be kept.
        expect(store.getRemaining("stale", config)).toBeLessThan(
            config.maxRequests
        );

        mockNow(120_000);
        store.purgeExpired();

        // Now two full windows past t=0 -> truly inert -> purged.
        expect(store.getRemaining("stale", config)).toBe(config.maxRequests);
        // "fresh" (touched at 70s, 50s ago) -> kept.
        expect(store.getRemaining("fresh", config)).toBe(
            config.maxRequests - 1
        );
    });

    it("purgeExpired does not grant a fresh bucket right after a maxed burst", () => {
        const store = new InMemoryRateLimitStore();

        // Max out the bucket in the sub-window anchored at t=0.
        mockNow(0);
        for (let i = 0; i < 10; i++) {
            expect(store.consume("k", config)).toBe(true);
        }

        // A purge sweep fires just past the sub-window boundary. With the
        // old `>= windowMs` threshold this evicted the entry and the next
        // burst passed in full — the fixed-window bug reintroduced via purge.
        mockNow(60_001);
        store.purgeExpired();
        expect(store.consume("k", config)).toBe(false);
    });
});

describe("rateLimitMiddleware bucket isolation", () => {
    async function get(app: { handle: (req: Request) => Promise<Response> }) {
        return app.handle(
            new Request("http://localhost/x", {
                headers: { "x-forwarded-for": "1.2.3.4" },
            })
        );
    }

    it("gives limiters with identical config but distinct buckets their own window", async () => {
        const config = { windowMs: 60_000, maxRequests: 1 };
        const { Elysia } = await import("elysia");

        const a = new Elysia()
            .use(rateLimitMiddleware({ bucket: "bucket-a", ...config }))
            .get("/x", () => "a");
        const b = new Elysia()
            .use(rateLimitMiddleware({ bucket: "bucket-b", ...config }))
            .get("/x", () => "b");

        expect((await get(a)).status).toBe(200);
        expect((await get(a)).status).toBe(429);

        // Elysia dedupes plugins on `{name, seed}`; without `bucket` in the
        // seed this second limiter would be discarded and inherit A's window.
        expect((await get(b)).status).toBe(200);
    });
});
