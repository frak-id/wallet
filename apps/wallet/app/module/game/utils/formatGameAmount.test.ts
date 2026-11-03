import { describe, expect, it } from "vitest";
import { formatGameAmount } from "./formatGameAmount";

describe("formatGameAmount", () => {
    it("drops the cents on whole amounts", () => {
        expect(formatGameAmount(1, "fr-FR")).toMatch(/^1\s€$/);
        expect(formatGameAmount(100, "en-US")).toBe("€100");
    });

    it("keeps two decimals otherwise", () => {
        expect(formatGameAmount(1.5, "fr-FR")).toMatch(/^1,50\s€$/);
    });
});
