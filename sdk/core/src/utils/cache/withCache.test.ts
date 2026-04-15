import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../../tests/vitest-fixtures";
import { clearAllCache, withCache } from "./withCache";

describe("withCache", () => {
    beforeEach(() => {
        clearAllCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("caching behavior", () => {
        it("should call fn on first invocation", async () => {
            const fn = vi.fn().mockResolvedValue("result");

            const result = await withCache(fn, {
                cacheKey: "test-key",
            });

            expect(fn).toHaveBeenCalledOnce();
            expect(result).toBe("result");
        });

        it("should return cached result on subsequent calls within TTL", async () => {
            const fn = vi.fn().mockResolvedValue("result");

            await withCache(fn, {
                cacheKey: "test-key",
                cacheTime: 10_000,
            });
            const result = await withCache(fn, {
                cacheKey: "test-key",
                cacheTime: 10_000,
            });

            expect(fn).toHaveBeenCalledOnce();
            expect(result).toBe("result");
        });

        it("should re-fetch after cache expires", async () => {
            vi.useFakeTimers();

            const fn = vi
                .fn()
                .mockResolvedValueOnce("first")
                .mockResolvedValueOnce("second");

            const first = await withCache(fn, {
                cacheKey: "test-key",
                cacheTime: 100,
            });
            expect(first).toBe("first");

            // Advance past TTL
            vi.advanceTimersByTime(200);

            const second = await withCache(fn, {
                cacheKey: "test-key",
                cacheTime: 100,
            });
            expect(second).toBe("second");
            expect(fn).toHaveBeenCalledTimes(2);

            vi.useRealTimers();
        });

        it("should not cache when cacheTime is 0", async () => {
            const fn = vi.fn().mockResolvedValue("result");

            await withCache(fn, { cacheKey: "test-key", cacheTime: 0 });
            await withCache(fn, { cacheKey: "test-key", cacheTime: 0 });

            expect(fn).toHaveBeenCalledTimes(2);
        });

        it("should use different caches for different keys", async () => {
            const fnA = vi.fn().mockResolvedValue("a");
            const fnB = vi.fn().mockResolvedValue("b");

            const a = await withCache(fnA, { cacheKey: "key-a" });
            const b = await withCache(fnB, { cacheKey: "key-b" });

            expect(a).toBe("a");
            expect(b).toBe("b");
            expect(fnA).toHaveBeenCalledOnce();
            expect(fnB).toHaveBeenCalledOnce();
        });
    });

    describe("deduplication", () => {
        it("should deduplicate concurrent calls with the same key", async () => {
            let resolvePromise: (value: string) => void;
            const fn = vi.fn().mockImplementation(
                () =>
                    new Promise<string>((resolve) => {
                        resolvePromise = resolve;
                    })
            );

            const promise1 = withCache(fn, { cacheKey: "dedup-key" });
            const promise2 = withCache(fn, { cacheKey: "dedup-key" });

            // fn should only be called once
            expect(fn).toHaveBeenCalledOnce();

            // Both should resolve to the same value
            resolvePromise!("shared");
            const [result1, result2] = await Promise.all([promise1, promise2]);
            expect(result1).toBe("shared");
            expect(result2).toBe("shared");
        });
    });

    describe("error handling", () => {
        it("should propagate errors from fn", async () => {
            const fn = vi.fn().mockRejectedValue(new Error("fetch failed"));

            await expect(
                withCache(fn, { cacheKey: "error-key" })
            ).rejects.toThrow("fetch failed");
        });

        it("should not cache errors — subsequent call retries", async () => {
            vi.useFakeTimers();
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("fail"))
                .mockResolvedValueOnce("recovered");

            await expect(
                withCache(fn, { cacheKey: "retry-key" })
            ).rejects.toThrow("fail");

            // Advance past the negative cache backoff (1s)
            vi.advanceTimersByTime(1_001);

            const result = await withCache(fn, { cacheKey: "retry-key" });
            expect(result).toBe("recovered");
            expect(fn).toHaveBeenCalledTimes(2);

            vi.useRealTimers();
        });
    });

    describe("clearAllCache", () => {
        it("should clear all cached data", async () => {
            const fn = vi
                .fn()
                .mockResolvedValueOnce("first")
                .mockResolvedValueOnce("second");

            await withCache(fn, { cacheKey: "clear-key" });
            clearAllCache();
            const result = await withCache(fn, { cacheKey: "clear-key" });

            expect(result).toBe("second");
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });
});
