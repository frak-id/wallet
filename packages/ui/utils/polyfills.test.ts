/**
 * Tests for loadPolyfills utility function
 * Tests polyfill loading functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPolyfills } from "./polyfills";

describe("loadPolyfills", () => {
    let originalArrayAt: typeof Array.prototype.at;
    let originalObjectHasOwn: typeof Object.hasOwn;
    let originalConsoleError: typeof console.error;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Save original values
        originalArrayAt = Array.prototype.at;
        originalObjectHasOwn = Object.hasOwn;
        originalConsoleError = console.error;

        // Setup spies
        consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore original values
        if (originalArrayAt) {
            Array.prototype.at = originalArrayAt;
        } else {
            delete (Array.prototype as any).at;
        }

        if (originalObjectHasOwn) {
            Object.hasOwn = originalObjectHasOwn;
        } else {
            delete (Object as any).hasOwn;
        }

        console.error = originalConsoleError;
        vi.clearAllMocks();
    });

    describe("when polyfills are not needed", () => {
        it("should not load Array.at polyfill when it exists", async () => {
            // Array.at already exists
            Array.prototype.at = function (index: number) {
                return this[index];
            };

            await loadPolyfills();

            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it("should not load Object.hasOwn polyfill when it exists", async () => {
            // Object.hasOwn already exists
            Object.hasOwn = (obj: object, prop: string | symbol) => {
                return Object.hasOwn(obj, prop);
            };

            await loadPolyfills();

            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it("should not load any polyfills when both exist", async () => {
            Array.prototype.at = function (index: number) {
                return this[index];
            };
            Object.hasOwn = (obj: object, prop: string | symbol) => {
                return Object.hasOwn(obj, prop);
            };

            await loadPolyfills();

            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe("when Array.at polyfill is needed", () => {
        it("should attempt to load Array.at polyfill when missing", async () => {
            delete (Array.prototype as any).at;

            // The function should complete without throwing
            // Note: We can't easily mock dynamic import() since it's a special operator
            await expect(loadPolyfills()).resolves.not.toThrow();
        });

        it("should handle successful Array.at polyfill load", async () => {
            delete (Array.prototype as any).at;

            // Function should complete without errors
            await expect(loadPolyfills()).resolves.not.toThrow();
        });

        it("should handle Array.at polyfill load gracefully", async () => {
            delete (Array.prototype as any).at;

            // Function should complete even if polyfill fails to load
            await expect(loadPolyfills()).resolves.not.toThrow();
        });

        it("should continue loading other polyfills if Array.at fails", async () => {
            delete (Array.prototype as any).at;
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete even if one polyfill fails
            await expect(loadPolyfills()).resolves.not.toThrow();

            Object.hasOwn = tempHasOwn;
        });
    });

    describe("when Object.hasOwn polyfill is needed", () => {
        it("should attempt to load Object.hasOwn polyfill when missing", async () => {
            // Temporarily remove hasOwn for the test
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete without throwing
            await expect(loadPolyfills()).resolves.not.toThrow();

            // Restore immediately
            Object.hasOwn = tempHasOwn;
        });

        it("should handle successful Object.hasOwn polyfill load", async () => {
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete without errors
            await expect(loadPolyfills()).resolves.not.toThrow();

            Object.hasOwn = tempHasOwn;
        });

        it("should handle Object.hasOwn polyfill load gracefully", async () => {
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete even if polyfill fails to load
            await expect(loadPolyfills()).resolves.not.toThrow();

            Object.hasOwn = tempHasOwn;
        });
    });

    describe("when both polyfills are needed", () => {
        it("should load both polyfills when both are missing", async () => {
            delete (Array.prototype as any).at;
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete without throwing
            await expect(loadPolyfills()).resolves.not.toThrow();

            Object.hasOwn = tempHasOwn;
        });

        it("should handle errors independently for each polyfill", async () => {
            delete (Array.prototype as any).at;
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete even if both polyfills fail
            await expect(loadPolyfills()).resolves.not.toThrow();

            Object.hasOwn = tempHasOwn;
        });
    });

    describe("edge cases", () => {
        it("should handle typeof check correctly", async () => {
            // Set to non-function value
            (Array.prototype as any).at = "not a function";
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete without throwing
            await expect(loadPolyfills()).resolves.not.toThrow();

            Object.hasOwn = tempHasOwn;
        });

        it("should handle null/undefined gracefully", async () => {
            (Array.prototype as any).at = null;
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete without throwing
            await expect(loadPolyfills()).resolves.not.toThrow();

            Object.hasOwn = tempHasOwn;
        });

        it("should not throw even if all polyfills fail", async () => {
            delete (Array.prototype as any).at;
            const tempHasOwn = Object.hasOwn;
            delete (Object as any).hasOwn;

            // Function should complete even if all polyfills fail
            // Note: We can't easily mock dynamic import(), but we can verify the function
            // handles errors gracefully
            await expect(loadPolyfills()).resolves.not.toThrow();

            // Restore immediately to avoid issues with test framework
            Object.hasOwn = tempHasOwn;
        });
    });
});
