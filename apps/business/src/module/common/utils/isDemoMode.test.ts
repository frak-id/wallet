import { describe, expect, it, vi } from "vitest";

// Mock TanStack Start's getRequestHeader
vi.mock("@tanstack/react-start/server", () => ({
    getRequestHeader: vi.fn(),
}));

describe("isDemoMode", () => {
    describe("cookie parsing", () => {
        it("should return true when business_demoMode cookie is true", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=true; other_cookie=value"
            );

            // Re-import to get fresh module with mocked dependency
            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(true);
        });

        it("should return false when business_demoMode cookie is false", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=false; other_cookie=value"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });

        it("should return false when business_demoMode cookie is missing", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "other_cookie=value; another_cookie=data"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });

        it("should return false when no cookies present", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue("");

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });

        it("should return false when cookie header is null", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(undefined);

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });

        it("should return false when cookie header is undefined", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(undefined);

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });
    });

    describe("cookie format variations", () => {
        it("should handle cookie with spaces around equals sign", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode = true"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false); // Won't match due to spaces
        });

        it("should handle cookie with leading spaces", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                " business_demoMode=true"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(true); // trim() handles leading spaces
        });

        it("should handle multiple semicolons", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=true;; other=value"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(true);
        });

        it("should handle cookie as only value", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=true"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(true);
        });

        it("should handle cookie at end of string", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "other=value; business_demoMode=true"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(true);
        });
    });

    describe("boolean value parsing", () => {
        it("should return false for non-true values", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=1; other=value"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });

        it("should return false for yes value", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=yes"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false);
        });

        it("should return false for True with capital T", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=True"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(false); // Strict comparison with "true"
        });

        it("should return true only for exact 'true' string", async () => {
            const { getRequestHeader } = await import(
                "@tanstack/react-start/server"
            );
            vi.mocked(getRequestHeader).mockReturnValue(
                "business_demoMode=true"
            );

            vi.resetModules();
            const { isDemoModeActive } = await import("./isDemoMode");

            const result = await isDemoModeActive();
            expect(result).toBe(true);
        });
    });
});
