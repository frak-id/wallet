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

vi.mock("@frak-labs/client/server", () => ({
    backendApi: {
        common: {
            rate: {
                get: vi.fn(),
            },
        },
    },
}));

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

const mockToken = createMockAddress("token");

const RATES = { eur: 0.92, usd: 1.0, gbp: 0.79 };

// Converted values are 100 units at the rates above.
const CONVERSIONS = [
    { currency: "eur", converted: "92", symbol: "€" },
    { currency: "usd", converted: "100", symbol: "$" },
    { currency: "gbp", converted: "79", symbol: "£" },
] as const;

describe("useConvertToPreferredCurrency", () => {
    describe("with amount parameter", () => {
        for (const { currency, converted, symbol } of CONVERSIONS) {
            test(`should convert amount to preferred currency (${currency})`, async ({
                queryWrapper,
                freshCurrencyStore,
            }: TestContext) => {
                freshCurrencyStore.getState().setCurrency(currency);

                vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                    data: RATES,
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

                expect(result.current).toContain(converted);
                expect(result.current).toContain(symbol);
            });
        }
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
            vi.mocked(backendApi.common.rate.get).mockResolvedValueOnce({
                data: RATES,
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
            freshCurrencyStore.getState().setCurrency("eur");

            vi.mocked(backendApi.common.rate.get).mockResolvedValue({
                data: RATES,
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

            freshCurrencyStore.getState().setCurrency("usd");
            rerender();

            await waitFor(() => {
                expect(result.current).toContain("$");
            });
        });
    });
});
