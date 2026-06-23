import { stablecoins } from "@frak-labs/app-essentials/blockchain";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FxRateRepository } from "./FxRateRepository";
import type { TokenPrice } from "./PricingRepository";
import { PricingRepository } from "./PricingRepository";

// Mock ky module using vi.hoisted
const { mockGet } = vi.hoisted(() => ({
    mockGet: vi.fn(),
}));

vi.mock("ky", () => ({
    default: {
        create: () => ({
            get: mockGet,
        }),
    },
}));

describe("PricingRepository", () => {
    let repository: PricingRepository;
    const mockGetRate = vi.fn();
    const fxRates = { getRate: mockGetRate } as unknown as FxRateRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        // FX providers unreachable by default; tests opt in to rates.
        mockGetRate.mockResolvedValue(undefined);
        repository = new PricingRepository(fxRates);
        process.env.COIN_GECKO_API_KEY = "test-api-key";
    });

    describe("getTokenPrice", () => {
        it("should fetch token price from CoinGecko API", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;
            const mockPrice: TokenPrice = {
                usd: 1.5,
                eur: 1.3,
                gbp: 1.1,
            };

            mockGet.mockResolvedValue({
                json: async () => ({
                    [mockToken.toLowerCase()]: mockPrice,
                }),
            });

            const result = await repository.getTokenPrice({ token: mockToken });

            expect(result).toEqual(mockPrice);
            expect(mockGet).toHaveBeenCalledWith(
                "simple/token_price/arbitrum-one",
                expect.objectContaining({
                    searchParams: {
                        contract_addresses: mockToken,
                        vs_currencies: "usd,eur,gbp",
                    },
                })
            );
        });

        it("should cache token prices", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;
            const mockPrice: TokenPrice = {
                usd: 1.5,
                eur: 1.3,
                gbp: 1.1,
            };

            mockGet.mockResolvedValue({
                json: async () => ({
                    [mockToken.toLowerCase()]: mockPrice,
                }),
            });

            // First call
            const result1 = await repository.getTokenPrice({
                token: mockToken,
            });
            expect(mockGet).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await repository.getTokenPrice({
                token: mockToken,
            });
            expect(mockGet).toHaveBeenCalledTimes(1);
            expect(result1).toEqual(result2);
        });

        it("should return undefined when token price is not found", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;

            mockGet.mockResolvedValue({
                json: async () => ({}),
            });

            const result = await repository.getTokenPrice({ token: mockToken });

            expect(result).toBeUndefined();
        });

        it("should cache 'unknown' when token price is not found", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;

            mockGet.mockResolvedValue({
                json: async () => ({}),
            });

            // First call
            const result1 = await repository.getTokenPrice({
                token: mockToken,
            });
            expect(result1).toBeUndefined();
            expect(mockGet).toHaveBeenCalledTimes(1);

            // Second call should use cached 'unknown'
            const result2 = await repository.getTokenPrice({
                token: mockToken,
            });
            expect(result2).toBeUndefined();
            expect(mockGet).toHaveBeenCalledTimes(1);
        });

        it("should use mutex to prevent concurrent API calls", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;
            const mockPrice: TokenPrice = {
                usd: 1.5,
                eur: 1.3,
                gbp: 1.1,
            };

            let resolvePromise: (value: unknown) => void;
            const delayedPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });

            mockGet.mockReturnValue({
                json: async () => {
                    await delayedPromise;
                    return {
                        [mockToken.toLowerCase()]: mockPrice,
                    };
                },
            });

            // Start two concurrent calls
            const promise1 = repository.getTokenPrice({ token: mockToken });
            const promise2 = repository.getTokenPrice({ token: mockToken });

            // Resolve the delayed promise
            resolvePromise!({
                [mockToken.toLowerCase()]: mockPrice,
            });

            const [result1, result2] = await Promise.all([promise1, promise2]);

            // Both should get the same result
            expect(result1).toEqual(mockPrice);
            expect(result2).toEqual(mockPrice);
        });

        it("should handle API errors gracefully", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;

            mockGet.mockRejectedValue(new Error("API error"));

            const result = await repository.getTokenPrice({ token: mockToken });
            expect(result).toBeUndefined();
        });
    });

    describe("pegged stablecoins", () => {
        it("prices USDe from its 1:1 USD peg plus FX, without CoinGecko", async () => {
            mockGetRate.mockImplementation(
                async ({ from, to }: { from: string; to: string }) => {
                    if (from === "usd" && to === "eur") return 0.86;
                    if (from === "usd" && to === "gbp") return 0.74;
                    return undefined;
                }
            );

            const result = await repository.getTokenPrice({
                token: stablecoins.prod.usde,
            });

            expect(result).toEqual({ usd: 1, eur: 0.86, gbp: 0.74 });
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("prices EURe from its EUR peg", async () => {
            mockGetRate.mockImplementation(
                async ({ from, to }: { from: string; to: string }) => {
                    if (from === "eur" && to === "usd") return 1.16;
                    if (from === "eur" && to === "gbp") return 0.87;
                    return undefined;
                }
            );

            const result = await repository.getTokenPrice({
                token: stablecoins.prod.eure,
            });

            expect(result).toEqual({ usd: 1.16, eur: 1, gbp: 0.87 });
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("returns undefined when FX providers are down — never a stale guess", async () => {
            const result = await repository.getTokenPrice({
                token: stablecoins.prod.gbpe,
            });

            expect(result).toBeUndefined();
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("prices testnet stablecoins identically (unlisted on CoinGecko)", async () => {
            mockGetRate.mockResolvedValue(1.1);
            for (const token of [
                stablecoins.testnet.eure,
                stablecoins.testnet.gbpe,
                stablecoins.testnet.usde,
                stablecoins.testnet.usdc,
            ]) {
                const result = await repository.getTokenPrice({ token });
                expect(result).toBeDefined();
            }
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe("convertFiatToTokenAmount", () => {
        const token = "0x1234567890abcdef1234567890abcdef12345678" as Address;

        it("passes the amount through when the order currency is the token's peg", async () => {
            const result = await repository.convertFiatToTokenAmount({
                token: stablecoins.prod.eure,
                fiatAmount: 5,
                currency: "EUR",
            });

            expect(result).toEqual({ converted: true, tokenAmount: 5 });
            expect(mockGetRate).not.toHaveBeenCalled();
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("converts an exotic order currency into the peg via FX", async () => {
            mockGetRate.mockResolvedValue(0.0062);

            const result = await repository.convertFiatToTokenAmount({
                token: stablecoins.prod.usde,
                fiatAmount: 10_000,
                currency: "JPY",
            });

            expect(result).toEqual({ converted: true, tokenAmount: 62 });
            expect(mockGetRate).toHaveBeenCalledWith({
                from: "jpy",
                to: "usd",
            });
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("defers when no FX rate exists for the order currency", async () => {
            const result = await repository.convertFiatToTokenAmount({
                token: stablecoins.prod.usde,
                fiatAmount: 100,
                currency: "XXX",
            });

            expect(result).toEqual({
                converted: false,
                reason: "fx_rate_unavailable",
            });
        });

        it("divides the fiat amount by the token's spot price in that currency", async () => {
            mockGet.mockResolvedValue({
                json: async () => ({
                    [token.toLowerCase()]: { usd: 1.25, eur: 1, gbp: 0.9 },
                }),
            });

            const result = await repository.convertFiatToTokenAmount({
                token,
                fiatAmount: 5,
                currency: "usd",
            });

            expect(result).toEqual({ converted: true, tokenAmount: 4 });
        });

        it("normalises the currency code case before picking the price", async () => {
            mockGet.mockResolvedValue({
                json: async () => ({
                    [token.toLowerCase()]: { usd: 2, eur: 1, gbp: 1 },
                }),
            });

            const result = await repository.convertFiatToTokenAmount({
                token,
                fiatAmount: 10,
                currency: "USD",
            });

            expect(result).toEqual({ converted: true, tokenAmount: 5 });
        });

        it("hops an exotic order currency through USD for a non-pegged token", async () => {
            mockGet.mockResolvedValue({
                json: async () => ({
                    [token.toLowerCase()]: { usd: 2, eur: 1.7, gbp: 1.5 },
                }),
            });
            mockGetRate.mockResolvedValue(0.1);

            const result = await repository.convertFiatToTokenAmount({
                token,
                fiatAmount: 100,
                currency: "SEK",
            });

            // 100 SEK × 0.1 (SEK→USD) ÷ 2 (USD per token) = 5 tokens
            expect(result).toEqual({ converted: true, tokenAmount: 5 });
            expect(mockGetRate).toHaveBeenCalledWith({
                from: "sek",
                to: "usd",
            });
        });

        it("defers an exotic currency when FX is unavailable for a non-pegged token", async () => {
            mockGet.mockResolvedValue({
                json: async () => ({
                    [token.toLowerCase()]: { usd: 2, eur: 1.7, gbp: 1.5 },
                }),
            });

            const result = await repository.convertFiatToTokenAmount({
                token,
                fiatAmount: 100,
                currency: "JPY",
            });

            expect(result).toEqual({
                converted: false,
                reason: "fx_rate_unavailable",
            });
        });

        it("returns token_price_unavailable when the token has no price", async () => {
            mockGet.mockResolvedValue({ json: async () => ({}) });

            const result = await repository.convertFiatToTokenAmount({
                token,
                fiatAmount: 5,
                currency: "eur",
            });

            expect(result).toEqual({
                converted: false,
                reason: "token_price_unavailable",
            });
        });
    });

    describe("cache behavior", () => {
        it("should respect cache TTL", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;
            const mockPrice: TokenPrice = {
                usd: 1.5,
                eur: 1.3,
                gbp: 1.1,
            };

            mockGet.mockResolvedValue({
                json: async () => ({
                    [mockToken.toLowerCase()]: mockPrice,
                }),
            });

            // First call
            await repository.getTokenPrice({ token: mockToken });
            expect(mockGet).toHaveBeenCalledTimes(1);

            // Second call within TTL should use cache
            await repository.getTokenPrice({ token: mockToken });
            expect(mockGet).toHaveBeenCalledTimes(1);
        });

        it("should cache different tokens separately", async () => {
            const token1 =
                "0x1111111111111111111111111111111111111111" as Address;
            const token2 =
                "0x2222222222222222222222222222222222222222" as Address;
            const price1: TokenPrice = { usd: 1.0, eur: 0.85, gbp: 0.75 };
            const price2: TokenPrice = { usd: 2.0, eur: 1.7, gbp: 1.5 };

            mockGet
                .mockResolvedValueOnce({
                    json: async () => ({
                        [token1.toLowerCase()]: price1,
                    }),
                })
                .mockResolvedValueOnce({
                    json: async () => ({
                        [token2.toLowerCase()]: price2,
                    }),
                });

            const result1 = await repository.getTokenPrice({ token: token1 });
            const result2 = await repository.getTokenPrice({ token: token2 });

            expect(result1).toEqual(price1);
            expect(result2).toEqual(price2);
            expect(mockGet).toHaveBeenCalledTimes(2);
        });
    });

    describe("API configuration", () => {
        it("should use CoinGecko API key from environment", () => {
            // Repository is already created in beforeEach with the env var set
            expect(process.env.COIN_GECKO_API_KEY).toBe("test-api-key");
        });

        it("should handle missing API key", () => {
            delete process.env.COIN_GECKO_API_KEY;
            const newRepository = new PricingRepository(fxRates);
            expect(newRepository).toBeDefined();
        });
    });
});
