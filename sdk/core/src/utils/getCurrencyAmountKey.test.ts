/**
 * Tests for getCurrencyAmountKey utility function
 * Tests currency amount key generation
 */

import { describe, expect, it } from "../../tests/vitest-fixtures";
import type { Currency } from "../types";
import { getCurrencyAmountKey } from "./getCurrencyAmountKey";

describe("getCurrencyAmountKey", () => {
    it("should return eurAmount for undefined input", () => {
        const result = getCurrencyAmountKey(undefined);

        expect(result).toBe("eurAmount");
    });

    it("should return eurAmount for EUR", () => {
        const result = getCurrencyAmountKey("eur");

        expect(result).toBe("eurAmount");
    });

    it("should return usdAmount for USD", () => {
        const result = getCurrencyAmountKey("usd");

        expect(result).toBe("usdAmount");
    });

    it("should return gbpAmount for GBP", () => {
        const result = getCurrencyAmountKey("gbp");

        expect(result).toBe("gbpAmount");
    });

    it("should generate correct key format for all currencies", () => {
        const validCurrencies: Currency[] = ["eur", "usd", "gbp"];

        for (const currency of validCurrencies) {
            const result = getCurrencyAmountKey(currency);
            // Should match pattern: {currency}Amount
            expect(result).toBe(`${currency}Amount`);
        }
    });
});
