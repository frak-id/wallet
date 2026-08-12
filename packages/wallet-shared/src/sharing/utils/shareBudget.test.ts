import { describe, expect, it } from "vitest";
import { SHARE_BUDGET, truncateForShare } from "./shareBudget";

describe("truncateForShare", () => {
    it("leaves a value inside the budget untouched", () => {
        expect(truncateForShare("Discover this", 280)).toBe("Discover this");
    });

    it("leaves a value exactly at the budget untouched", () => {
        const exact = "a".repeat(120);
        expect(truncateForShare(exact, 120)).toBe(exact);
    });

    it("clips past the budget and stays within it, ellipsis included", () => {
        const result = truncateForShare("a".repeat(400), 280);
        expect(result.length).toBeLessThanOrEqual(280);
        expect(result.endsWith("…")).toBe(true);
    });

    it("never splits a surrogate pair", () => {
        // Each emoji is two UTF-16 units, so a naive slice at an odd index breaks one.
        const result = truncateForShare("😀".repeat(50), 21);
        expect(result).not.toContain("\uFFFD");
        expect(result.endsWith("…")).toBe(true);
        // Everything before the ellipsis is whole emoji.
        expect([...result.slice(0, -1)].every((c) => c === "😀")).toBe(true);
    });

    it("keeps a combining mark with its base character", () => {
        const result = truncateForShare("e\u0301".repeat(40), 21);
        expect(result.endsWith("…")).toBe(true);
        // A dangling combining acute would mean the base was cut away from it.
        expect(result.slice(0, -1).startsWith("\u0301")).toBe(false);
    });

    it("trims the whitespace a cut can leave before the ellipsis", () => {
        expect(truncateForShare(`${"a".repeat(15)}     bbbb`, 20)).toBe(
            `${"a".repeat(15)}…`
        );
    });

    it("budgets the caps the wire contract pins", () => {
        expect(SHARE_BUDGET).toEqual({ title: 120, text: 280, image: 512 });
    });
});
