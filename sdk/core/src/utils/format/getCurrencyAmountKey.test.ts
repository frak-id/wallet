import { describe, expect, it } from "../../../tests/vitest-fixtures";
import type { Currency } from "../../types";
import { getCurrencyAmountKey } from "./getCurrencyAmountKey";

describe("getCurrencyAmountKey", () => {
    it.each<Currency>(["eur", "usd", "gbp"])(
        "should return %sAmount",
        (currency) => {
            expect(getCurrencyAmountKey(currency)).toBe(`${currency}Amount`);
        }
    );

    it("should return eurAmount for undefined input", () => {
        expect(getCurrencyAmountKey(undefined)).toBe("eurAmount");
    });
});
