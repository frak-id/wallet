import { describe, expect, it } from "vitest";

describe("localStorage utilities", () => {
    describe("getFromLocalStorage", () => {
        it("should get item from localStorage", async () => {
            const { getFromLocalStorage } = await import("./safeSession");

            const testData = { test: "value" };
            localStorage.setItem("test-key", JSON.stringify(testData));

            const result = getFromLocalStorage("test-key");

            expect(result).toEqual(testData);

            localStorage.removeItem("test-key");
        });

        it("should return undefined for non-existent key", async () => {
            const { getFromLocalStorage } = await import("./safeSession");

            const result = getFromLocalStorage("non-existent-key");

            expect(result).toBeUndefined();
        });

        it("should parse JSON from localStorage", async () => {
            const { getFromLocalStorage } = await import("./safeSession");

            const testData = { nested: { value: 123 }, array: [1, 2, 3] };
            localStorage.setItem("complex-key", JSON.stringify(testData));

            const result = getFromLocalStorage("complex-key");

            expect(result).toEqual(testData);

            localStorage.removeItem("complex-key");
        });

        it("should handle empty string", async () => {
            const { getFromLocalStorage } = await import("./safeSession");

            localStorage.setItem("empty-key", "");

            const result = getFromLocalStorage("empty-key");

            expect(result).toBeUndefined();

            localStorage.removeItem("empty-key");
        });
    });
});
