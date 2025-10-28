import { describe, expect, it } from "vitest";

describe("i18n module exports", () => {
    it("should re-export config values", async () => {
        const module = await import("./index");

        expect(module).toHaveProperty("supportedLngs");
        expect(module).toHaveProperty("fallbackLng");
        expect(module).toHaveProperty("defaultNS");
    });

    it("should export supportedLngs", async () => {
        const { supportedLngs } = await import("./index");

        expect(supportedLngs).toBeDefined();
        expect(Array.isArray(supportedLngs)).toBe(true);
        expect(supportedLngs.length).toBeGreaterThan(0);
    });

    it("should export fallbackLng", async () => {
        const { fallbackLng } = await import("./index");

        expect(fallbackLng).toBeDefined();
        expect(typeof fallbackLng).toBe("string");
    });
});
