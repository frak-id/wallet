/**
 * Tests for formatAmount utility function
 * Tests currency formatting with proper locale support
 */

import { describe, expect, it } from "../../../tests/vitest-fixtures";
import goldenRewards from "../../rewards/fixtures/golden-rewards.json";
import type { Currency } from "../../types";
import { formatAmount } from "./formatAmount";

/**
 * Render a string as its codepoints, so an assertion failure on an invisible
 * ICU character (U+202F narrow no-break space vs U+00A0 no-break space) is
 * readable instead of a mystery. See `scripts/generate-golden-rewards.ts`.
 */
const codepoints = (value: string): string[] =>
    Array.from(value, (char) => {
        const code = char.codePointAt(0) ?? 0;
        return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
    });

type FormatAmountFixture = {
    name: string;
    description: string;
    kind: "format-amount";
    amount: number;
    currency: Currency | null;
    locale: string;
    formatted: string;
    formattedCodepoints: string[];
};

// The JSON import is inferred as a union of per-entry literal shapes, which
// narrows to `never` under a type predicate. Widen ONCE to the declared
// fixture type so the payload fields stay genuinely type-checked and a corpus
// shape drift is a type error rather than a silent pass.
const formatAmountFixtures = (
    goldenRewards.fixtures as unknown as FormatAmountFixture[]
).filter(
    (fixture): fixture is FormatAmountFixture =>
        fixture.kind === "format-amount"
);

describe("formatAmount golden fixtures", () => {
    it("declares the expected format version", () => {
        expect(goldenRewards.formatVersion).toBe(1);
    });

    it("covers all three supported currencies", () => {
        const currencies = new Set(
            formatAmountFixtures.map((fixture) => fixture.currency)
        );
        expect(currencies).toEqual(new Set(["eur", "usd", "gbp", null]));
    });

    it.each(formatAmountFixtures)(
        "reproduces the exact string for: $description",
        (fixture) => {
            const formatted = formatAmount(
                fixture.amount,
                fixture.currency ?? undefined
            );

            // Compare codepoints FIRST: a mismatch on an invisible separator
            // reports as `U+202F` vs `U+00A0` rather than two strings that
            // look identical in the diff.
            expect(codepoints(formatted)).toEqual(fixture.formattedCodepoints);
            expect(formatted).toBe(fixture.formatted);
        }
    );

    it("keeps the literal and the codepoint list in sync", () => {
        for (const fixture of formatAmountFixtures) {
            expect(codepoints(fixture.formatted)).toEqual(
                fixture.formattedCodepoints
            );
        }
    });
});

describe("formatAmount", () => {
    it("should format EUR with French locale by default", () => {
        // fr-FR separates the amount from the symbol with U+00A0, not a space.
        expect(formatAmount(1000, "eur")).toBe("1\u202f000\u00a0\u20ac");
    });

    it("should format USD with US locale", () => {
        expect(formatAmount(1000, "usd")).toBe("$1,000");
    });

    it("should format GBP with British locale", () => {
        expect(formatAmount(1000, "gbp")).toBe("\u00a31,000");
    });

    it("should format integer amounts without decimal places", () => {
        expect(formatAmount(1000, "eur")).toBe("1\u202f000\u00a0\u20ac");
        expect(formatAmount(1000, "usd")).toBe("$1,000");
    });

    it("should format decimal amounts with up to 2 decimal places", () => {
        expect(formatAmount(1234.56, "eur")).toBe("1\u202f234,56\u00a0\u20ac");
    });

    it("should handle zero amount", () => {
        expect(formatAmount(0, "eur")).toBe("0\u00a0\u20ac");
    });

    it("should handle large amounts", () => {
        // Two group separators, both U+202F on CLDR >= 34.
        expect(formatAmount(1000000, "eur")).toBe(
            "1\u202f000\u202f000\u00a0\u20ac"
        );
    });

    it("should default to EUR when currency is not provided", () => {
        expect(formatAmount(1000)).toBe(formatAmount(1000, "eur"));
        expect(formatAmount(1000)).toBe("1\u202f000\u00a0\u20ac");
    });

    it("should format negative amounts", () => {
        // Not pinned in the golden corpus: negative currency formatting is a
        // second ICU drift axis (ASCII U+002D vs U+2212 MINUS SIGN) and the
        // SDK never displays a negative reward. Assert the shape only.
        const formatted = formatAmount(-500, "eur");

        expect(formatted).toMatch(/^[-\u2212]500\u00a0\u20ac$/);
    });

    it("should round amounts with more than 2 decimal places", () => {
        expect(formatAmount(1234.5678, "eur")).toBe(
            "1\u202f234,57\u00a0\u20ac"
        );
        expect(formatAmount(1234.5612, "eur")).toBe(
            "1\u202f234,56\u00a0\u20ac"
        );
    });

    it("should format small decimal amounts", () => {
        expect(formatAmount(0.99, "usd")).toBe("$0.99");
    });

    it("should use correct locale for each currency", () => {
        expect(formatAmount(1000, "eur")).toBe("1\u202f000\u00a0\u20ac");
        expect(formatAmount(1000, "usd")).toBe("$1,000");
        expect(formatAmount(1000, "gbp")).toBe("\u00a31,000");
    });
});
