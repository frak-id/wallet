import { describe, expect, it } from "vitest";
import { ua } from "./ua";

describe("ua", () => {
    it("should have isMobile property", () => {
        expect(ua).toHaveProperty("isMobile");
        expect(typeof ua.isMobile).toBe("boolean");
    });

    it("should have detailed property", () => {
        expect(ua).toHaveProperty("detailed");
    });

    it("should parse user agent correctly", () => {
        // In test environment, navigator.userAgent is available via jsdom
        expect(ua.detailed).toBeDefined();
    });

    it("should determine mobile device type", () => {
        // Should not throw
        const isMobile = ua.isMobile;
        expect([true, false]).toContain(isMobile);
    });
});
