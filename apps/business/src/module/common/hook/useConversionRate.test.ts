import { backendApi } from "@frak-labs/client/server";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
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

const mockToken = createMockAddress("token");

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
                response: {} as Response,
                status: 200,
                headers: {},
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
                response: {} as Response,
                status: 200,
                headers: {},
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
                response: {} as Response,
                status: 200,
                headers: {},
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
                error: { status: 400, value: "Network error" },
                response: {} as Response,
                status: 400,
                headers: {},
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
                response: {} as Response,
                status: 200,
                headers: {},
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
                response: {} as Response,
                status: 200,
                headers: {},
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
});
