import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./postgresError";

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
