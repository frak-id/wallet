import type { Currency } from "@frak-labs/core-sdk";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

describe("currencyStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({
            freshCurrencyStore,
        }: TestContext) => {
            const state = freshCurrencyStore.getState();

            expect(state.preferredCurrency).toBe("eur");
        });
    });

    describe("setCurrency", () => {
        test("should update preferred currency", ({
            freshCurrencyStore,
        }: TestContext) => {
            freshCurrencyStore.getState().setCurrency("usd");

            expect(freshCurrencyStore.getState().preferredCurrency).toBe("usd");
        });

        test("should persist currency preference", ({
            freshCurrencyStore,
        }: TestContext) => {
            freshCurrencyStore.getState().setCurrency("gbp");

            // Check localStorage
            const stored = localStorage.getItem("business_preferredCurrency");
            expect(stored).toBeTruthy();
        });

        test("should handle all supported currencies", ({
            freshCurrencyStore,
        }: TestContext) => {
            const currencies: Currency[] = ["eur", "usd", "gbp"];

            for (const currency of currencies) {
                freshCurrencyStore.getState().setCurrency(currency);
                expect(freshCurrencyStore.getState().preferredCurrency).toBe(
                    currency
                );
            }
        });
    });
});
