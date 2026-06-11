import { describe, expect, it } from "vitest";
import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";

function collectKeys(obj: unknown, prefix = ""): string[] {
    if (typeof obj !== "object" || obj === null) return [prefix];
    return Object.entries(obj).flatMap(([key, value]) =>
        collectKeys(value, prefix ? `${prefix}.${key}` : key)
    );
}

describe("translation parity", () => {
    it("has matching key sets between en and fr", () => {
        const enKeys = collectKeys(en).sort();
        const frKeys = collectKeys(fr).sort();
        expect(frKeys).toEqual(enKeys);
    });
});
