import { describe, expect, it } from "vitest";
import {
    formatReference,
    isUniqueViolation,
} from "./BillingDocumentRepository";

describe("BillingDocumentRepository pure helpers", () => {
    describe("formatReference", () => {
        it("formats a deposit reference", () => {
            expect(formatReference("deposit", 2026, 1)).toBe("DEP-2026-0001");
        });

        it("formats a withdraw reference", () => {
            expect(formatReference("withdraw", 2026, 1)).toBe("WDR-2026-0001");
        });

        it("formats a monthly_bill reference", () => {
            expect(formatReference("monthly_bill", 2026, 1)).toBe(
                "BILL-2026-0001"
            );
        });

        it("zero-pads the counter to 4 digits", () => {
            expect(formatReference("deposit", 2026, 42)).toBe("DEP-2026-0042");
        });

        it("does not truncate a counter wider than 4 digits", () => {
            expect(formatReference("deposit", 2026, 12345)).toBe(
                "DEP-2026-12345"
            );
        });
    });

    describe("isUniqueViolation", () => {
        it("returns true for a Postgres unique_violation (23505)", () => {
            expect(isUniqueViolation({ code: "23505" })).toBe(true);
        });

        it("returns false for a different SQLSTATE code", () => {
            expect(isUniqueViolation({ code: "23504" })).toBe(false);
        });

        it("returns false for null", () => {
            expect(isUniqueViolation(null)).toBe(false);
        });

        it("returns false for an error object without a code", () => {
            expect(isUniqueViolation({ message: "x" })).toBe(false);
        });
    });
});
