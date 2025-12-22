/**
 * Tests for detectPWA utility function
 * Tests PWA detection functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectPWA } from "./detectPWA";

describe("detectPWA", () => {
    let originalMatchMedia: typeof window.matchMedia;
    let originalNavigator: Navigator;
    let matchMediaMock: any;

    beforeEach(() => {
        // Save original values
        originalMatchMedia = window.matchMedia;
        originalNavigator = window.navigator;

        // Create mock matchMedia
        matchMediaMock = vi.fn((query: string) => {
            return {
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            } as MediaQueryList;
        });

        window.matchMedia = matchMediaMock;
    });

    afterEach(() => {
        // Restore original values
        window.matchMedia = originalMatchMedia;
        Object.defineProperty(window, "navigator", {
            value: originalNavigator,
            writable: true,
            configurable: true,
        });
        vi.clearAllMocks();
    });

    describe("standalone detection", () => {
        it("should detect standalone mode via matchMedia", () => {
            // matchMedia is called multiple times: once for isStandalone, then for getDisplayMode
            matchMediaMock.mockImplementation((query: string) => {
                return {
                    matches: query === "(display-mode: standalone)",
                    media: query,
                } as MediaQueryList;
            });

            const result = detectPWA();

            expect(result.isPWA).toBe(true);
            expect(result.displayMode).toBe("standalone");
        });

        it("should detect iOS standalone mode", () => {
            matchMediaMock.mockReturnValueOnce({
                matches: false,
                media: "(display-mode: standalone)",
            } as MediaQueryList);

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: true,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            expect(result.isPWA).toBe(true);
            expect(result.isPWAIos).toBe(true);
        });

        it("should return false when not in standalone mode", () => {
            matchMediaMock.mockImplementation(() => {
                return {
                    matches: false,
                    media: "",
                } as MediaQueryList;
            });

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: undefined,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            expect(result.isPWA).toBeFalsy(); // false or undefined
            expect(result.isPWAIos).toBeFalsy(); // undefined or false
        });

        it("should prioritize matchMedia standalone over iOS standalone", () => {
            matchMediaMock.mockReturnValueOnce({
                matches: true,
                media: "(display-mode: standalone)",
            } as MediaQueryList);

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: false,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            expect(result.isPWA).toBe(true);
        });
    });

    describe("display mode detection", () => {
        it("should detect fullscreen mode", () => {
            matchMediaMock.mockImplementation((query: string) => {
                return {
                    matches: query === "(display-mode: fullscreen)",
                    media: query,
                } as MediaQueryList;
            });

            const result = detectPWA();

            expect(result.displayMode).toBe("fullscreen");
        });

        it("should detect minimal-ui mode", () => {
            matchMediaMock.mockImplementation((query: string) => {
                return {
                    matches: query === "(display-mode: minimal-ui)",
                    media: query,
                } as MediaQueryList;
            });

            const result = detectPWA();

            expect(result.displayMode).toBe("minimal-ui");
        });

        it("should default to browser mode when no match", () => {
            matchMediaMock.mockImplementation(() => {
                return {
                    matches: false,
                    media: "",
                } as MediaQueryList;
            });

            const result = detectPWA();

            expect(result.displayMode).toBe("browser");
        });

        it("should check modes in order", () => {
            let callCount = 0;
            matchMediaMock.mockImplementation((query: string) => {
                callCount++;
                // Return true for standalone (second in the array)
                return {
                    matches: query === "(display-mode: standalone)",
                    media: query,
                } as MediaQueryList;
            });

            const result = detectPWA();

            expect(result.displayMode).toBe("standalone");
            // Should have checked fullscreen first, then standalone
            expect(callCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe("iOS specific detection", () => {
        it("should detect iOS standalone", () => {
            matchMediaMock.mockReturnValueOnce({
                matches: false,
                media: "(display-mode: standalone)",
            } as MediaQueryList);

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: true,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            expect(result.isPWAIos).toBe(true);
        });

        it("should return false for iOS standalone when not standalone", () => {
            matchMediaMock.mockReturnValueOnce({
                matches: false,
                media: "(display-mode: standalone)",
            } as MediaQueryList);

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: false,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            expect(result.isPWAIos).toBe(false);
        });

        it("should return false/undefined for iOS standalone when undefined", () => {
            matchMediaMock.mockImplementation(() => {
                return {
                    matches: false,
                    media: "",
                } as MediaQueryList;
            });

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: undefined,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            // When undefined, the function returns undefined (falsy)
            expect(result.isPWAIos).toBeFalsy();
        });
    });

    describe("integration", () => {
        it("should return all PWA detection properties", () => {
            matchMediaMock.mockReturnValueOnce({
                matches: true,
                media: "(display-mode: standalone)",
            } as MediaQueryList);

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: true,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            expect(result).toHaveProperty("isPWA");
            expect(result).toHaveProperty("isPWAIos");
            expect(result).toHaveProperty("displayMode");
            expect(typeof result.isPWA).toBe("boolean");
            expect(typeof result.isPWAIos).toBe("boolean");
            expect(typeof result.displayMode).toBe("string");
        });

        it("should handle browser mode correctly", () => {
            matchMediaMock.mockImplementation(() => {
                return {
                    matches: false,
                    media: "",
                } as MediaQueryList;
            });

            Object.defineProperty(window, "navigator", {
                value: {
                    ...originalNavigator,
                    standalone: undefined,
                },
                writable: true,
                configurable: true,
            });

            const result = detectPWA();

            expect(result.isPWA).toBeFalsy(); // false or undefined
            expect(result.isPWAIos).toBeFalsy(); // false or undefined
            expect(result.displayMode).toBe("browser");
        });
    });
});
