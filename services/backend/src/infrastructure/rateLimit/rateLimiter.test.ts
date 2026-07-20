import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryRateLimitStore } from "./rateLimiter";

/**
 * `isRunningLocally` short-circuits `consume()` to always allow, so these
 * tests must run with it falsy. The test env doesn't set the local-dev
 * markers that flag, so this holds by default in CI/vitest.
 */
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

    it("purgeExpired evicts entries whose current sub-window is stale", () => {
        const store = new InMemoryRateLimitStore();

        mockNow(0);
        store.consume("stale", config);

        mockNow(70_000);
        store.consume("fresh", config);

        store.purgeExpired();

        // "stale" hasn't rolled since t=0, so its currentStart (0) is more
        // than one windowMs behind now (70_000) -> purged.
        expect(store.getRemaining("stale", config)).toBe(config.maxRequests);
        // "fresh" was just touched -> kept, still reflects its consumption.
        expect(store.getRemaining("fresh", config)).toBe(
            config.maxRequests - 1
        );
    });
});
