import { describe, expect, test } from "@/tests/vitest-fixtures";
import { computeDepositBreakdown } from "./computeDepositBreakdown";

describe("computeDepositBreakdown", () => {
    test("FR: extracts 20% VAT from gross, fee on the VAT-exclusive base", () => {
        // gross 1200 -> vat 200, feeBase 1000, frakFee 200, net 800
        const result = computeDepositBreakdown("1200", "FR");
        expect(result).not.toBeNull();
        expect(result?.vatApplies).toBe(true);
        expect(result?.vat).toBeCloseTo(200, 6);
        expect(result?.frakFee).toBeCloseTo(200, 6);
        expect(result?.net).toBeCloseTo(800, 6);
    });

    test("non-FR: no VAT, fee is 20% of gross", () => {
        // gross 1000 -> vat 0, frakFee 200, net 800
        const result = computeDepositBreakdown("1000", "US");
        expect(result?.vatApplies).toBe(false);
        expect(result?.vat).toBe(0);
        expect(result?.frakFee).toBeCloseTo(200, 6);
        expect(result?.net).toBeCloseTo(800, 6);
    });

    test("mirrors the server for a zero gross", () => {
        const result = computeDepositBreakdown("0", "FR");
        expect(result).toEqual({
            gross: 0,
            vat: 0,
            frakFee: 0,
            net: 0,
            vatApplies: true,
        });
    });

    test.each([
        "",
        "   ",
        "not-a-number",
        "-10",
        "Infinity",
    ])("returns null for unusable input %j", (input) => {
        expect(computeDepositBreakdown(input, "FR")).toBeNull();
    });
});
