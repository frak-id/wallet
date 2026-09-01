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

describe("truncateForShare — budget is a wire budget", () => {
    it("clips a string whose grapheme count is under max but whose length is not", () => {
        // Family-of-four ZWJ sequences: 1 grapheme, 11 UTF-16 units each.
        const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
        const value = family.repeat(30);
        expect(value.length).toBeGreaterThan(120);
        const result = truncateForShare(value, 120);
        expect(result.length).toBeLessThanOrEqual(120);
        expect(result.endsWith("…")).toBe(true);
    });

    it("never exceeds the budget for any max on a multi-unit string", () => {
        const value = "😀".repeat(40);
        for (let max = 1; max <= 40; max++) {
            expect(truncateForShare(value, max).length).toBeLessThanOrEqual(
                max
            );
        }
    });

    it("never splits a surrogate pair, at any max", () => {
        const values = [
            "😀".repeat(40),
            "e\u0301".repeat(40),
            "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}".repeat(10),
            `a😀${"b".repeat(20)}`,
        ];
        for (const value of values) {
            for (let max = 1; max <= 40; max++) {
                const result = truncateForShare(value, max);
                expect(result.length).toBeLessThanOrEqual(max);
                expect(result).not.toContain("\uFFFD");
                // A trailing high surrogate means the cut landed inside a pair.
                const last = result.charCodeAt(result.length - 1);
                if (result.length > 0) {
                    expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
                }
            }
        }
    });

    it("returns whole graphemes when max leaves no room for the ellipsis", () => {
        // A lone surrogate here would render as U+FFFD.
        expect(truncateForShare("😀…", 1)).toBe("");
        // At max 2 there is room to mark the cut, but not for the emoji beside it.
        expect(truncateForShare("😀ab", 2)).toBe("…");
        expect(truncateForShare("😀ab", 3)).toBe("😀…");
    });
});
