import { describe, expect, it } from "vitest";

describe("isDemoMode", () => {
    describe("deprecated isDemoModeActive function", () => {
        it("should always return false (deprecated function)", async () => {
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });

        it("should be replaced with context.isDemoMode in server functions", () => {
            // This is just a documentation test
            // Demo mode is now passed via authMiddleware context instead of cookies
            expect(true).toBe(true);
        });
    });
});
