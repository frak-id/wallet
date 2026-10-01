import { describe, expect, it } from "vitest";
import { replaceAmbassadorVariables, replaceVariables } from "./variables";

// Literal rather than formatAmount(42, "eur"): computing the expectation with
// the same function the subject calls would let a formatting regression pass.
// Note the non-breaking space (U+00A0) the Intl formatter emits.
const reward = "42\u00a0€";
const friendReward = "10\u00a0€";

describe("replaceVariables", () => {
    it("returns an empty string for empty input", () => {
        expect(replaceVariables("", "eur", "Acme")).toBe("");
    });

    it("replaces {{ estimatedReward }} with inner whitespace", () => {
        expect(
            replaceVariables("Earn {{ estimatedReward }}", "eur", "Acme")
        ).toBe(`Earn ${reward}`);
    });

    it("replaces {{estimatedReward}} without whitespace", () => {
        expect(
            replaceVariables("Earn {{estimatedReward}}", "eur", "Acme")
        ).toBe(`Earn ${reward}`);
    });

    it("replaces the legacy {REWARD} alias", () => {
        expect(replaceVariables("Earn {REWARD}", "eur", "Acme")).toBe(
            `Earn ${reward}`
        );
    });

    it("replaces {{ productName }} with the shop name", () => {
        expect(
            replaceVariables("Shop at {{ productName }}", "eur", "Acme")
        ).toBe("Shop at Acme");
    });

    it("replaces every occurrence of a repeated token", () => {
        expect(
            replaceVariables(
                "{{ estimatedReward }} then {{ estimatedReward }}",
                "eur",
                "Acme"
            )
        ).toBe(`${reward} then ${reward}`);
    });

    it("leaves {BRAND} as typed, since only the ambassador page fills it live", () => {
        expect(replaceVariables("Join {BRAND} now", "eur", "Acme")).toBe(
            "Join {BRAND} now"
        );
    });

    it("fills {REWARD} with the given amount", () => {
        expect(replaceVariables("Earn {REWARD}", "eur", "Acme", 10)).toBe(
            `Earn ${friendReward}`
        );
    });

    it("fills {REWARD} with 42 when no amount is given", () => {
        expect(replaceVariables("Earn {REWARD}", "eur", "Acme")).toBe(
            `Earn ${reward}`
        );
    });

    it("formats the given amount in the passed currency", () => {
        expect(replaceVariables("Earn {REWARD}", "usd", "Acme", 10)).toBe(
            "Earn $10"
        );
    });

    it("passes a token-free string through unchanged", () => {
        expect(replaceVariables("Nothing to replace", "eur", "Acme")).toBe(
            "Nothing to replace"
        );
    });
});

describe("replaceAmbassadorVariables", () => {
    it("replaces {BRAND} with the shop name and {REWARD} with the given amount", () => {
        expect(
            replaceAmbassadorVariables(
                "Earn {REWARD} at {BRAND}",
                "eur",
                "Acme",
                10
            )
        ).toBe(`Earn ${friendReward} at Acme`);
    });
});
