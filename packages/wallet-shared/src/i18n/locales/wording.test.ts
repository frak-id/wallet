import { describe, expect, it } from "vitest";
import fr from "./fr/translation.json";

function collectTexts(obj: unknown, prefix = ""): [string, string][] {
    if (typeof obj === "string") return [[prefix, obj]];
    if (typeof obj !== "object" || obj === null) return [];
    return Object.entries(obj).flatMap(([key, value]) =>
        collectTexts(value, prefix ? `${prefix}.${key}` : key)
    );
}

describe("French wording", () => {
    it("says récupérer, never réclamer, for a reward", () => {
        const offenders = collectTexts(fr)
            .filter(([, text]) => /réclam/i.test(text))
            .map(([key]) => key);
        expect(offenders).toEqual([]);
    });
});
