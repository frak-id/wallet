import { describe, expect, it } from "vitest";
import { maskIban } from "./maskIban";

describe("maskIban", () => {
    it("renders only the last 4 characters with leading bullets", () => {
        expect(maskIban("FR7630006000011234567890189")).toBe("•••• 0189");
    });

    it("strips whitespace before slicing", () => {
        expect(maskIban("FR76 3000 6000 0112 3456 7890 189")).toBe("•••• 0189");
    });

    it("returns the input unchanged when shorter than the 4-char tail", () => {
        expect(maskIban("AB12")).toBe("AB12");
        expect(maskIban("")).toBe("");
    });
});
