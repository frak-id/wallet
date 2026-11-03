import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./postgresError";

const driverError = (code: string) =>
    Object.assign(new Error("duplicate key value"), { code });

describe("isUniqueViolation", () => {
    it("returns true for a Postgres unique_violation (23505)", () => {
        expect(isUniqueViolation({ code: "23505" })).toBe(true);
    });

    it("returns true when drizzle wrapped the driver error", () => {
        const wrapped = new DrizzleQueryError(
            "insert into t values ($1)",
            ["x"],
            driverError("23505")
        );

        expect(isUniqueViolation(wrapped)).toBe(true);
    });

    it("returns false when drizzle wrapped a different SQLSTATE", () => {
        const wrapped = new DrizzleQueryError(
            "insert into t values ($1)",
            ["x"],
            driverError("42P01")
        );

        expect(isUniqueViolation(wrapped)).toBe(false);
    });

    it("gives up on a cause chain deeper than it should look", () => {
        const deep = {
            cause: { cause: { cause: { code: "23505" } } },
        };

        expect(isUniqueViolation(deep)).toBe(false);
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
