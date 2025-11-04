import { backendApi } from "@frak-labs/client/server";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { vi } from "vitest";
import { describe, expect, type TestContext, test } from "@/tests/fixtures";
import { useConvertToPreferredCurrency } from "./useConversionRate";

// Mock the backend API
vi.mock("@frak-labs/client/server", () => ({
    backendApi: {
        common: {
            rate: {
                get: vi.fn(),
            },
        },
    },
}));

// Mock the demo mode hook
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

const mockToken = "0x1234567890123456789012345678901234567890" as Address;

describe("useConvertToPreferredCurrency", () => {
    describe("with amount parameter", () => {
        test("should convert amount to preferred currency (EUR)", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            // Set preferred currency to EUR
            freshCurrencyStore.getState().setCurrency("eur");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        amount: 100,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            // Wait for query to resolve
            await waitFor(() => {
                expect(result.current).toBeDefined();
            });

            // 100 * 0.92 = 92 EUR
            expect(result.current).toContain("92");
            expect(result.current).toContain("€");
        });

        test("should convert amount to preferred currency (USD)", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            // Set preferred currency to USD
            freshCurrencyStore.getState().setCurrency("usd");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        amount: 100,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeDefined();
            });

            // 100 * 1.0 = 100 USD
            expect(result.current).toContain("100");
            expect(result.current).toContain("$");
        });

        test("should convert amount to preferred currency (GBP)", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            // Set preferred currency to GBP
            freshCurrencyStore.getState().setCurrency("gbp");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        amount: 100,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeDefined();
            });

            // 100 * 0.79 = 79 GBP
            expect(result.current).toContain("79");
            expect(result.current).toContain("£");
        });
    });

    describe("with balance and decimals", () => {
        test("should convert balance with decimals to preferred currency", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            freshCurrencyStore.getState().setCurrency("eur");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            // 1000000000000000000n (1e18) with 18 decimals = 1.0
            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        balance: 1000000000000000000n,
                        decimals: 18,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeDefined();
            });

            // 1.0 * 0.92 = 0.92 EUR
            expect(result.current).toContain("0.92");
            expect(result.current).toContain("€");
        });

        test("should handle large balance values", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            freshCurrencyStore.getState().setCurrency("usd");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            // 1000 tokens (1000 * 1e18)
            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        balance: 1000000000000000000000n,
                        decimals: 18,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeDefined();
            });

            // 1000 * 1.0 = 1000 USD
            expect(result.current).toContain("1,000");
            expect(result.current).toContain("$");
        });

        test("should handle tokens with 6 decimals (USDC-like)", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            freshCurrencyStore.getState().setCurrency("usd");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            // 100 USDC (100 * 1e6)
            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        balance: 100000000n,
                        decimals: 6,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeDefined();
            });

            // 100 * 1.0 = 100 USD
            expect(result.current).toContain("100");
        });
    });

    describe("edge cases", () => {
        test("should return undefined when no token provided", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        amount: 100,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current).toBeUndefined();
        });

        test("should return undefined when conversion rate fails", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock failed API call
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: null,
                error: "Network error",
            });

            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        amount: 100,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeUndefined();
            });
        });

        test("should return undefined when neither amount nor balance provided", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeUndefined();
            });
        });

        test("should return undefined when balance provided without decimals", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        balance: 1000000000000000000n,
                        // Missing decimals parameter
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeUndefined();
            });
        });
    });

    describe("currency preference updates", () => {
        test("should recalculate when currency preference changes", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            // Start with EUR
            freshCurrencyStore.getState().setCurrency("eur");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValue({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            const { result, rerender } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        amount: 100,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toContain("€");
            });

            // Change to USD
            freshCurrencyStore.getState().setCurrency("usd");
            rerender();

            await waitFor(() => {
                expect(result.current).toContain("$");
            });
        });
    });

    describe("amount vs balance priority", () => {
        test("should prefer amount over balance when both provided", async ({
            queryWrapper,
            freshCurrencyStore,
        }: TestContext) => {
            freshCurrencyStore.getState().setCurrency("usd");

            // Mock conversion rate response
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: {
                    eur: 0.92,
                    usd: 1.0,
                    gbp: 0.79,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useConvertToPreferredCurrency({
                        token: mockToken,
                        amount: 100, // Should use this
                        balance: 1000000000000000000n, // Should ignore this
                        decimals: 18,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current).toBeDefined();
            });

            // Should be 100 USD (from amount), not 1 USD (from balance)
            expect(result.current).toContain("100");
        });
    });
});
