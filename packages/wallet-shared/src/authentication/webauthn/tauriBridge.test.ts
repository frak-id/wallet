import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fromBase64Url, toBase64Url } from "./tauriBridge";

describe("tauriBridge", () => {
    describe("base64url conversion utilities", () => {
        describe("toBase64Url", () => {
            it("should convert ArrayBuffer to base64url string", () => {
                const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
                const result = toBase64Url(buffer);
                expect(result).toBe("SGVsbG8");
            });

            it("should convert Uint8Array to base64url string", () => {
                const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
                const result = toBase64Url(bytes);
                expect(result).toBe("SGVsbG8");
            });

            it("should replace + with - and / with _", () => {
                // Create bytes that would produce + and / in base64
                // 0xFB = 251, 0xFF = 255 would produce +/ in base64
                const bytes = new Uint8Array([251, 255]);
                const result = toBase64Url(bytes);
                expect(result).not.toContain("+");
                expect(result).not.toContain("/");
                expect(result).toContain("-");
                expect(result).toContain("_");
            });

            it("should remove padding characters", () => {
                // "A" in base64 is "QQ==" with padding
                const bytes = new Uint8Array([65]);
                const result = toBase64Url(bytes);
                expect(result).not.toContain("=");
            });

            it("should handle empty buffer", () => {
                const buffer = new ArrayBuffer(0);
                const result = toBase64Url(buffer);
                expect(result).toBe("");
            });

            it("should handle ArrayBufferView", () => {
                const buffer = new Uint8Array([0, 72, 101, 108, 108, 111, 0]);
                // Create a view of just the "Hello" portion
                const view = new DataView(buffer.buffer, 1, 5);
                const result = toBase64Url(view);
                expect(result).toBe("SGVsbG8");
            });
        });

        describe("fromBase64Url", () => {
            it("should convert base64url string to ArrayBuffer", () => {
                const base64url = "SGVsbG8"; // "Hello"
                const result = fromBase64Url(base64url);
                const bytes = new Uint8Array(result);
                expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
            });

            it("should handle - and _ characters", () => {
                // Create a base64url string with - and _
                const base64url = "--__"; // equivalent to +/+/ in standard base64
                const result = fromBase64Url(base64url);
                expect(result).toBeInstanceOf(ArrayBuffer);
            });

            it("should handle strings without padding", () => {
                // "A" without padding
                const base64url = "QQ";
                const result = fromBase64Url(base64url);
                const bytes = new Uint8Array(result);
                expect(bytes[0]).toBe(65); // 'A'
            });

            it("should handle empty string", () => {
                const result = fromBase64Url("");
                expect(result.byteLength).toBe(0);
            });
        });

        describe("round-trip conversion", () => {
            it("should preserve data through round-trip conversion", () => {
                const original = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 0]);
                const encoded = toBase64Url(original);
                const decoded = fromBase64Url(encoded);
                const result = new Uint8Array(decoded);
                expect(Array.from(result)).toEqual(Array.from(original));
            });

            it("should handle WebAuthn challenge-like data", () => {
                // Simulate a 32-byte challenge
                const challenge = new Uint8Array(32);
                for (let i = 0; i < 32; i++) {
                    challenge[i] = i * 8;
                }
                const encoded = toBase64Url(challenge);
                const decoded = fromBase64Url(encoded);
                const result = new Uint8Array(decoded);
                expect(Array.from(result)).toEqual(Array.from(challenge));
            });
        });
    });

    describe("getTauriCreateFn", () => {
        let originalWindow: typeof globalThis.window;

        beforeEach(() => {
            originalWindow = globalThis.window;
            vi.resetModules();
        });

        afterEach(() => {
            globalThis.window = originalWindow;
            vi.resetAllMocks();
        });

        it("should return undefined when not running in Tauri", async () => {
            // Ensure we're not in Tauri
            Object.defineProperty(globalThis, "window", {
                value: {
                    location: {
                        hostname: "localhost",
                        protocol: "https:",
                    },
                },
                writable: true,
                configurable: true,
            });

            const { getTauriCreateFn } = await import("./tauriBridge");
            const createFn = getTauriCreateFn();
            expect(createFn).toBeUndefined();
        });

        it("should return a function when running in Tauri (Android)", async () => {
            // Simulate Tauri Android environment
            Object.defineProperty(globalThis, "window", {
                value: {
                    location: {
                        hostname: "tauri.localhost",
                        protocol: "https:",
                    },
                },
                writable: true,
                configurable: true,
            });

            const { getTauriCreateFn } = await import("./tauriBridge");
            const createFn = getTauriCreateFn();
            expect(createFn).toBeDefined();
            expect(typeof createFn).toBe("function");
        });

        it("should return a function when running in Tauri (iOS)", async () => {
            // Simulate Tauri iOS environment
            Object.defineProperty(globalThis, "window", {
                value: {
                    location: {
                        hostname: "localhost",
                        protocol: "tauri:",
                    },
                },
                writable: true,
                configurable: true,
            });

            const { getTauriCreateFn } = await import("./tauriBridge");
            const createFn = getTauriCreateFn();
            expect(createFn).toBeDefined();
            expect(typeof createFn).toBe("function");
        });
    });

    describe("getTauriGetFn", () => {
        let originalWindow: typeof globalThis.window;

        beforeEach(() => {
            originalWindow = globalThis.window;
            vi.resetModules();
        });

        afterEach(() => {
            globalThis.window = originalWindow;
            vi.resetAllMocks();
        });

        it("should return undefined when not running in Tauri", async () => {
            // Ensure we're not in Tauri
            Object.defineProperty(globalThis, "window", {
                value: {
                    location: {
                        hostname: "localhost",
                        protocol: "https:",
                    },
                },
                writable: true,
                configurable: true,
            });

            const { getTauriGetFn } = await import("./tauriBridge");
            const getFn = getTauriGetFn();
            expect(getFn).toBeUndefined();
        });

        it("should return a function when running in Tauri", async () => {
            // Simulate Tauri environment
            Object.defineProperty(globalThis, "window", {
                value: {
                    location: {
                        hostname: "tauri.localhost",
                        protocol: "https:",
                    },
                },
                writable: true,
                configurable: true,
            });

            const { getTauriGetFn } = await import("./tauriBridge");
            const getFn = getTauriGetFn();
            expect(getFn).toBeDefined();
            expect(typeof getFn).toBe("function");
        });
    });
});
