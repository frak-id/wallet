import { beforeEach, describe, expect, it, vi } from "vitest";
import { FxRateRepository } from "./FxRateRepository";

// One mock per provider, routed by the prefix given to ky.create
const { frankfurterGet, erApiGet } = vi.hoisted(() => ({
    frankfurterGet: vi.fn(),
    erApiGet: vi.fn(),
}));

vi.mock("ky", () => ({
    default: {
        create: ({ prefix }: { prefix: string }) => ({
            get: prefix.includes("frankfurter") ? frankfurterGet : erApiGet,
        }),
    },
}));

describe("FxRateRepository", () => {
    let repository: FxRateRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repository = new FxRateRepository();
    });

    it("returns 1 for same-currency pairs without any fetch", async () => {
        const rate = await repository.getRate({ from: "EUR", to: "eur" });

        expect(rate).toBe(1);
        expect(frankfurterGet).not.toHaveBeenCalled();
        expect(erApiGet).not.toHaveBeenCalled();
    });

    it("fetches the rate table from Frankfurter and picks the quote", async () => {
        frankfurterGet.mockResolvedValue({
            json: async () => ({
                base: "JPY",
                rates: { USD: 0.0062, EUR: 0.0054 },
            }),
        });

        const rate = await repository.getRate({ from: "jpy", to: "usd" });

        expect(rate).toBe(0.0062);
        expect(frankfurterGet).toHaveBeenCalledWith("latest", {
            searchParams: { base: "JPY" },
        });
        expect(erApiGet).not.toHaveBeenCalled();
    });

    it("caches the rate table per base currency", async () => {
        frankfurterGet.mockResolvedValue({
            json: async () => ({
                base: "SEK",
                rates: { USD: 0.105, EUR: 0.091 },
            }),
        });

        const usd = await repository.getRate({ from: "SEK", to: "USD" });
        const eur = await repository.getRate({ from: "SEK", to: "EUR" });

        expect(usd).toBe(0.105);
        expect(eur).toBe(0.091);
        expect(frankfurterGet).toHaveBeenCalledTimes(1);
    });

    it("falls back to open.er-api when Frankfurter fails", async () => {
        frankfurterGet.mockRejectedValue(new Error("frankfurter down"));
        erApiGet.mockResolvedValue({
            json: async () => ({
                result: "success",
                rates: { USD: 0.0061 },
            }),
        });

        const rate = await repository.getRate({ from: "JPY", to: "USD" });

        expect(rate).toBe(0.0061);
        expect(erApiGet).toHaveBeenCalledWith("latest/JPY");
    });

    it("falls back when Frankfurter does not know the base currency", async () => {
        frankfurterGet.mockResolvedValue({
            json: async () => ({ rates: {} }),
        });
        erApiGet.mockResolvedValue({
            json: async () => ({
                result: "success",
                rates: { USD: 0.27 },
            }),
        });

        const rate = await repository.getRate({ from: "AED", to: "USD" });

        expect(rate).toBe(0.27);
    });

    it("returns undefined when both providers fail", async () => {
        frankfurterGet.mockRejectedValue(new Error("down"));
        erApiGet.mockRejectedValue(new Error("down too"));

        const rate = await repository.getRate({ from: "JPY", to: "USD" });

        expect(rate).toBeUndefined();
    });

    it("returns undefined when the quote currency is missing from the table", async () => {
        frankfurterGet.mockResolvedValue({
            json: async () => ({
                base: "JPY",
                rates: { EUR: 0.0054 },
            }),
        });

        const rate = await repository.getRate({ from: "JPY", to: "XXX" });

        expect(rate).toBeUndefined();
    });

    it("rejects malformed currency codes without fetching", async () => {
        expect(await repository.getRate({ from: "", to: "USD" })).toBe(
            undefined
        );
        expect(await repository.getRate({ from: "JPYX", to: "USD" })).toBe(
            undefined
        );
        expect(frankfurterGet).not.toHaveBeenCalled();
        expect(erApiGet).not.toHaveBeenCalled();
    });

    it("does not poison the cache with failures forever", async () => {
        frankfurterGet.mockRejectedValueOnce(new Error("down"));
        erApiGet.mockRejectedValueOnce(new Error("down too"));

        const miss = await repository.getRate({ from: "JPY", to: "USD" });
        expect(miss).toBeUndefined();

        // Failure is cached (no immediate refetch)
        const stillMiss = await repository.getRate({ from: "JPY", to: "USD" });
        expect(stillMiss).toBeUndefined();
        expect(frankfurterGet).toHaveBeenCalledTimes(1);
    });
});
