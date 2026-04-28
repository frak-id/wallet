import { describe, expect, it } from "vitest";
import { maskIban, shortenIban } from "./maskIban";

describe("maskIban", () => {
    it("renders only the last 4 characters with leading bullets", () => {
        expect(maskIban("FR7630006000011234567890189")).toBe("•••• 0189");
    });

    it("strips whitespace before slicing", () => {
        expect(maskIban("FR76 3000 6000 0112 3456 7890 189")).toBe("•••• 0189");
    });

    it("normalises lowercase country codes (no-op — bullets only show last 4)", () => {
        expect(maskIban("fr7630006000011234567890189")).toBe("•••• 0189");
    });

    it("returns the input unchanged when shorter than the 4-char tail", () => {
        expect(maskIban("AB12")).toBe("AB12");
        expect(maskIban("")).toBe("");
    });
});

describe("shortenIban", () => {
    it("keeps the first 4 and last 4 with an ellipsis between", () => {
        expect(shortenIban("FR7630006000011234567890189")).toBe("FR76...0189");
    });

    it("strips whitespace before slicing", () => {
        expect(shortenIban("FR76 3000 6000 0112 3456 7890 189")).toBe(
            "FR76...0189"
        );
    });

    it("returns the input unchanged when ≤11 chars", () => {
        expect(shortenIban("FR761234567")).toBe("FR761234567"); // 11 → unchanged
        expect(shortenIban("FR7612345678")).toBe("FR76...5678"); // 12 → ellipsis
        expect(shortenIban("")).toBe("");
    });
});
