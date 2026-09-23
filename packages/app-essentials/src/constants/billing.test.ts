import { describe, expect, it } from "vitest";
import { grossUpBankBalance, isVatApplicable } from "./billing";

const EUR = 10n ** 18n;

describe("grossUpBankBalance", () => {
    it("restores a 300 € FR deposit from its 200 € net balance", () => {
        expect(grossUpBankBalance(200n * EUR, true)).toEqual({
            gross: 300n * EUR,
            vat: 50n * EUR,
            frakFee: 50n * EUR,
            distributable: 200n * EUR,
        });
    });

    it("restores a 250 € reverse-charged deposit from its 200 € net balance", () => {
        expect(grossUpBankBalance(200n * EUR, false)).toEqual({
            gross: 250n * EUR,
            vat: 0n,
            frakFee: 50n * EUR,
            distributable: 200n * EUR,
        });
    });

    it("keeps the parts summing to the gross on odd 6-decimal amounts", () => {
        const breakdown = grossUpBankBalance(123_456_789n, true);
        expect(
            breakdown.distributable + breakdown.frakFee + breakdown.vat
        ).toBe(breakdown.gross);
    });

    it("returns zeros for an empty bank", () => {
        expect(grossUpBankBalance(0n, true)).toEqual({
            gross: 0n,
            vat: 0n,
            frakFee: 0n,
            distributable: 0n,
        });
    });
});

describe("isVatApplicable", () => {
    it("applies VAT to FR only", () => {
        expect(isVatApplicable("FR")).toBe(true);
        expect(isVatApplicable("DE")).toBe(false);
        expect(isVatApplicable(undefined)).toBe(false);
    });
});
