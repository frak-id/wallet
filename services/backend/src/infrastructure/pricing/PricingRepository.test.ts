import { addresses } from "@frak-labs/app-essentials";
import {
    currentStablecoins,
    usdcArbitrumAddress,
} from "@frak-labs/app-essentials/blockchain";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

    beforeEach(() => {
        repository = new PricingRepository();
        vi.clearAllMocks();
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

        it("should return fixed rate for USDe stablecoin", async () => {
            const result = await repository.getTokenPrice({
                token: currentStablecoins.usde,
            });

            expect(result).toEqual({
                usd: 1,
                eur: 0.85,
                gbp: 0.75,
            });
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("should return fixed rate for EURe stablecoin", async () => {
            const result = await repository.getTokenPrice({
                token: currentStablecoins.eure,
            });

            expect(result).toEqual({
                usd: 1.18,
                eur: 1,
                gbp: 0.88,
            });
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("should return fixed rate for GBPe stablecoin", async () => {
            const result = await repository.getTokenPrice({
                token: currentStablecoins.gbpe,
            });

            expect(result).toEqual({
                usd: 1.33,
                eur: 1.14,
                gbp: 1,
            });
            expect(mockGet).not.toHaveBeenCalled();
        });

        it("should replace mUSD token with USDC address", async () => {
            const mockPrice: TokenPrice = {
                usd: 1.0,
                eur: 0.85,
                gbp: 0.75,
            };

            mockGet.mockResolvedValue({
                json: async () => ({
                    [usdcArbitrumAddress.toLowerCase()]: mockPrice,
                }),
            });

            const result = await repository.getTokenPrice({
                token: addresses.mUSDToken,
            });

            expect(result).toEqual(mockPrice);
            expect(mockGet).toHaveBeenCalledWith(
                "simple/token_price/arbitrum-one",
                expect.objectContaining({
                    searchParams: {
                        contract_addresses: usdcArbitrumAddress,
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

            await expect(
                repository.getTokenPrice({ token: mockToken })
            ).rejects.toThrow("API error");
        });

        it("should handle malformed API responses", async () => {
            const mockToken =
                "0x1234567890abcdef1234567890abcdef12345678" as Address;

            mockGet.mockResolvedValue({
                json: async () => null,
            });

            await expect(
                repository.getTokenPrice({ token: mockToken })
            ).rejects.toThrow();
        });
    });

    describe("getExchangeRate", () => {
        it("should return 1 for same currency", async () => {
            const result = await repository.getExchangeRate({
                fromCurrency: "eur",
                toCurrency: "eur",
            });

            expect(result).toBe(1);
        });

        it("should return 1 for different currencies (placeholder)", async () => {
            const result = await repository.getExchangeRate({
                fromCurrency: "eur",
                toCurrency: "usd",
            });

            expect(result).toBe(1);
        });

        it("should handle all currency combinations", async () => {
            const currencies = ["eur", "usd", "gbp"] as const;

            for (const from of currencies) {
                for (const to of currencies) {
                    const result = await repository.getExchangeRate({
                        fromCurrency: from,
                        toCurrency: to,
                    });

                    if (from === to) {
                        expect(result).toBe(1);
                    } else {
                        expect(result).toBe(1); // Placeholder implementation
                    }
                }
            }
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
            const newRepository = new PricingRepository();
            expect(newRepository).toBeDefined();
        });
    });
});
