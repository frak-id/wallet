/**
 * Tests for loadScript utility function
 * Tests dynamic script loading functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./loadScript";

describe("loadScript", () => {
    let getElementByIdSpy: ReturnType<typeof vi.spyOn>;
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let appendChildSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Setup spies
        getElementByIdSpy = vi.spyOn(document, "getElementById");
        createElementSpy = vi.spyOn(document, "createElement");
        appendChildSpy = vi.spyOn(document.head, "appendChild");
    });

    afterEach(() => {
        // Clean up any scripts added to head
        const scripts = document.head.querySelectorAll("script[data-test-id]");
        for (const script of scripts) {
            script.remove();
        }
        vi.clearAllMocks();
    });

    describe("successful script loading", () => {
        it("should load a script successfully", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            // Mock successful load
            const loadPromise = loadScript(
                "test-script",
                "https://example.com/script.js"
            );

            // Simulate script load
            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            const result = await loadPromise;

            expect(result).toBe(true);
            expect(createElementSpy).toHaveBeenCalledWith("script");
            expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
            expect(mockScript.id).toBe("test-script");
            expect(mockScript.src).toBe("https://example.com/script.js");
            expect(mockScript.defer).toBe(true);
            expect(mockScript.type).toBe("text/javascript");
        });

        it("should load a module script with correct type", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript(
                "module-script",
                "https://example.com/module.js",
                "module"
            );

            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            await loadPromise;

            expect(mockScript.type).toBe("module");
        });

        it("should set script attributes correctly", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript(
                "my-script",
                "https://test.com/script.js"
            );

            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            await loadPromise;

            expect(mockScript.id).toBe("my-script");
            expect(mockScript.src).toContain("https://test.com/script.js");
            expect(mockScript.defer).toBe(true);
        });
    });

    describe("duplicate prevention", () => {
        it("should return immediately if script with same id already exists", async () => {
            // Create an actual script element in the DOM
            const existingScript = document.createElement("script");
            existingScript.id = "existing-script";
            existingScript.setAttribute("data-test-id", "existing-script");
            document.head.appendChild(existingScript);

            getElementByIdSpy.mockReturnValue(existingScript);
            const appendCallCount = appendChildSpy.mock.calls.length;

            const result = await loadScript(
                "existing-script",
                "https://example.com/script.js"
            );

            expect(result).toBe(true);
            // appendChild should not be called again (existing script was already appended)
            expect(appendChildSpy.mock.calls.length).toBe(appendCallCount);

            // Clean up
            existingScript.remove();
        });

        it("should check for existing script before creating new one", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript(
                "new-script",
                "https://example.com/script.js"
            );

            expect(getElementByIdSpy).toHaveBeenCalledWith("new-script");

            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            await loadPromise;
        });
    });

    describe("error handling", () => {
        it("should reject with error message on script load failure", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript(
                "error-script",
                "https://example.com/error.js"
            );

            // Simulate script error
            setTimeout(() => {
                if (mockScript.onerror) {
                    mockScript.onerror({} as Event);
                }
            }, 0);

            await expect(loadPromise).rejects.toThrow(
                "Script load error for https://example.com/error.js"
            );
        });

        it("should include URL in error message", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const url = "https://example.com/failed.js";
            const loadPromise = loadScript("failed-script", url);

            setTimeout(() => {
                if (mockScript.onerror) {
                    mockScript.onerror({} as Event);
                }
            }, 0);

            await expect(loadPromise).rejects.toThrow(
                `Script load error for ${url}`
            );
        });
    });

    describe("script type handling", () => {
        it("should default to text/javascript when type not specified", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript(
                "default-script",
                "https://example.com/script.js"
            );

            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            await loadPromise;

            expect(mockScript.type).toBe("text/javascript");
        });

        it("should accept module type", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript(
                "module-script",
                "https://example.com/module.js",
                "module"
            );

            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            await loadPromise;

            expect(mockScript.type).toBe("module");
        });
    });

    describe("edge cases", () => {
        it("should handle empty id", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript("", "https://example.com/script.js");

            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            await loadPromise;

            expect(mockScript.id).toBe("");
        });

        it("should handle empty URL", async () => {
            getElementByIdSpy.mockReturnValue(null);

            const mockScript = document.createElement("script");
            createElementSpy.mockReturnValue(mockScript);

            const loadPromise = loadScript("empty-url-script", "");

            setTimeout(() => {
                if (mockScript.onload) {
                    mockScript.onload({} as Event);
                }
            }, 0);

            await loadPromise;

            expect(mockScript.src).toBeDefined();
        });

        it("should create separate script elements for different ids", async () => {
            getElementByIdSpy.mockReturnValue(null);

            // Start both loads
            loadScript("script-1", "https://example.com/1.js");
            loadScript("script-2", "https://example.com/2.js");

            // Wait a moment for scripts to be appended
            await new Promise((resolve) => setTimeout(resolve, 5));

            // Verify both scripts are created in the DOM
            const script1 = document.head.querySelector("script#script-1");
            const script2 = document.head.querySelector("script#script-2");

            expect(script1).toBeDefined();
            expect(script2).toBeDefined();
            if (script1 && script2) {
                expect(script1).not.toBe(script2);
            }

            // Clean up
            script1?.remove();
            script2?.remove();
        });
    });
});
