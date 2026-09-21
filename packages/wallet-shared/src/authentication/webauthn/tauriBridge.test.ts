import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fromBase64Url, toBase64Url } from "./tauriBridge";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("../../common/tauri", () => ({
    getInvoke: () => Promise.resolve(mockInvoke),
}));

// Minimal plugin assertion response accepted by `fromPluginAuthentication`.
const STUB_ASSERTION = {
    id: "cred-id",
    rawId: "SGVsbG8",
    type: "public-key" as const,
    response: {
        clientDataJSON: "SGVsbG8",
        authenticatorData: "SGVsbG8",
        signature: "SGVsbG8",
    },
};

// Minimal request options the getFn will translate + forward. Cast to the
// ox `getFn` parameter type at each call site (ox uses its own
// `CredentialRequestOptions<false>` generic, not the DOM lib type).
const REQUEST_OPTIONS = {
    publicKey: {
        challenge: new Uint8Array([1, 2, 3]),
        rpId: "example.com",
    },
};
type GetFnArg = Parameters<
    NonNullable<ReturnType<typeof import("./tauriBridge")["getTauriGetFn"]>>
>[0];

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

        it("forwards preferImmediatelyAvailable:true in the authenticate payload", async () => {
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
            mockInvoke.mockResolvedValue(STUB_ASSERTION);

            const { getTauriGetFn } = await import("./tauriBridge");
            const getFn = getTauriGetFn({ preferImmediatelyAvailable: true });
            await getFn?.(REQUEST_OPTIONS as GetFnArg);

            expect(mockInvoke).toHaveBeenCalledTimes(1);
            const [command, args] = mockInvoke.mock.calls[0];
            expect(command).toBe("plugin:frak-webauthn|authenticate");
            expect(
                (args as { options: Record<string, unknown> }).options
                    .preferImmediatelyAvailable
            ).toBe(true);
        });

        it("omits preferImmediatelyAvailable when the flag is not set", async () => {
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
            mockInvoke.mockResolvedValue(STUB_ASSERTION);

            const { getTauriGetFn } = await import("./tauriBridge");
            const getFn = getTauriGetFn();
            await getFn?.(REQUEST_OPTIONS as GetFnArg);

            expect(mockInvoke).toHaveBeenCalledTimes(1);
            const [, args] = mockInvoke.mock.calls[0];
            expect(
                (args as { options: Record<string, unknown> }).options
            ).not.toHaveProperty("preferImmediatelyAvailable");
        });
    });

    describe("getPasskeyPresence", () => {
        let originalWindow: typeof globalThis.window;

        const setPlatform = (hostname: string, protocol: string) => {
            Object.defineProperty(globalThis, "window", {
                value: { location: { hostname, protocol } },
                writable: true,
                configurable: true,
            });
        };
        const setAndroid = () => setPlatform("tauri.localhost", "https:");

        beforeEach(() => {
            originalWindow = globalThis.window;
            vi.resetModules();
        });

        afterEach(() => {
            globalThis.window = originalWindow;
            vi.resetAllMocks();
            vi.useRealTimers();
            vi.unstubAllGlobals();
        });

        it("returns unknown without invoking outside Tauri", async () => {
            setPlatform("localhost", "https:");

            const { getPasskeyPresence } = await import("./tauriBridge");

            expect(await getPasskeyPresence()).toBe("unknown");
            expect(mockInvoke).not.toHaveBeenCalled();
        });

        it("returns unknown without invoking on Tauri iOS", async () => {
            setPlatform("localhost", "tauri:");

            const { getPasskeyPresence } = await import("./tauriBridge");

            expect(await getPasskeyPresence()).toBe("unknown");
            expect(mockInvoke).not.toHaveBeenCalled();
        });

        it("returns present when the plugin reports a passkey", async () => {
            setAndroid();
            mockInvoke.mockResolvedValue({ state: "present" });

            const { getPasskeyPresence } = await import("./tauriBridge");

            expect(await getPasskeyPresence()).toBe("present");
        });

        it("returns absent when the plugin reports no passkey", async () => {
            setAndroid();
            mockInvoke.mockResolvedValue({ state: "absent" });

            const { getPasskeyPresence } = await import("./tauriBridge");

            expect(await getPasskeyPresence()).toBe("absent");
        });

        it("returns unknown instead of throwing when the plugin rejects", async () => {
            setAndroid();
            mockInvoke.mockRejectedValue(
                new Error("androidx.credentials provider unavailable")
            );

            const { getPasskeyPresence } = await import("./tauriBridge");

            await expect(getPasskeyPresence()).resolves.toBe("unknown");
        });

        it("returns unknown for a malformed payload rather than coercing it", async () => {
            setAndroid();
            mockInvoke.mockResolvedValue({ state: "maybe" });

            const { getPasskeyPresence } = await import("./tauriBridge");

            expect(await getPasskeyPresence()).toBe("unknown");
        });

        it("resolves unknown once the timeout elapses on a hung invoke", async () => {
            setAndroid();
            mockInvoke.mockReturnValue(new Promise(() => {}));

            const { getPasskeyPresence } = await import("./tauriBridge");
            vi.useFakeTimers();
            const pending = getPasskeyPresence();
            await vi.advanceTimersByTimeAsync(10_000);

            expect(await pending).toBe("unknown");
        });

        it("sends the relying-party id and no immediately-available flag", async () => {
            setAndroid();
            mockInvoke.mockResolvedValue({ state: "absent" });

            // Resolve the config from the same re-evaluated module graph: a
            // statically imported `rpId` predates the faked platform.
            const [{ getPasskeyPresence }, { WebAuthN }] = await Promise.all([
                import("./tauriBridge"),
                import("@frak-labs/app-essentials"),
            ]);
            await getPasskeyPresence();

            expect(mockInvoke).toHaveBeenCalledTimes(1);
            const [command, args] = mockInvoke.mock.calls[0];
            expect(command).toBe("plugin:frak-webauthn|get_passkey_presence");
            const options = (args as { options: Record<string, unknown> })
                .options;
            expect(options.rpId).toBe(WebAuthN.rpId);
            expect(options.rpId).toBe("frak.id");
            expect(options).not.toHaveProperty("preferImmediatelyAvailable");
        });

        it("honors the platform literals the bundler bakes at build time", async () => {
            // The app build defines these; every other case here exercises the
            // runtime fallback, which would report "not Tauri" for this window.
            setPlatform("localhost", "https:");
            vi.stubGlobal("__IS_TAURI__", true);
            vi.stubGlobal("__IS_ANDROID__", true);
            mockInvoke.mockResolvedValue({ state: "present" });

            const { getPasskeyPresence } = await import("./tauriBridge");

            expect(await getPasskeyPresence()).toBe("present");
            expect(mockInvoke).toHaveBeenCalledTimes(1);
        });
    });
});
