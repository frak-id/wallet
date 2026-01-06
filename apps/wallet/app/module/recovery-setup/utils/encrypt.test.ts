import type { Address, Hex } from "viem";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("radash", () => ({
    random: vi.fn((min: number, _max: number) => min + 16),
}));

describe("encrypt utilities", () => {
    const mockPrivateKey: Hex =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const mockAddress: Address = "0x1234567890123456789012345678901234567890";
    const mockPass = "securePassword123";

    let mockImportKey: ReturnType<typeof vi.fn>;
    let mockDeriveKey: ReturnType<typeof vi.fn>;
    let mockEncrypt: ReturnType<typeof vi.fn>;
    let mockGetRandomValues: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockImportKey = vi.fn().mockResolvedValue({ type: "secret" });
        mockDeriveKey = vi.fn().mockResolvedValue({ type: "derived" });
        mockEncrypt = vi.fn().mockResolvedValue(new ArrayBuffer(64));
        mockGetRandomValues = vi.fn((array: Uint8Array) => {
            for (let i = 0; i < array.length; i++) {
                array[i] = i % 256;
            }
            return array;
        });

        Object.defineProperty(global, "window", {
            value: {
                crypto: {
                    subtle: {
                        importKey: mockImportKey,
                        deriveKey: mockDeriveKey,
                        encrypt: mockEncrypt,
                    },
                    getRandomValues: mockGetRandomValues,
                },
            },
            writable: true,
            configurable: true,
        });
    });

    describe("passToKey", () => {
        test("should derive key from password using PBKDF2", async () => {
            const { passToKey } = await import("./encrypt");
            const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

            await passToKey({ pass: mockPass, salt });

            expect(mockImportKey).toHaveBeenCalledWith(
                "raw",
                expect.any(Uint8Array),
                { name: "PBKDF2" },
                false,
                ["deriveBits", "deriveKey"]
            );

            expect(mockDeriveKey).toHaveBeenCalledWith(
                {
                    name: "PBKDF2",
                    salt: expect.any(Uint8Array),
                    iterations: 300_000,
                    hash: "SHA-512",
                },
                expect.anything(),
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );
        });

        test("should use 300,000 iterations for key derivation", async () => {
            const { passToKey } = await import("./encrypt");
            const salt = new Uint8Array([1, 2, 3, 4]);

            await passToKey({ pass: mockPass, salt });

            const deriveKeyCall = mockDeriveKey.mock.calls[0][0];
            expect(deriveKeyCall.iterations).toBe(300_000);
        });

        test("should use SHA-512 hash algorithm", async () => {
            const { passToKey } = await import("./encrypt");
            const salt = new Uint8Array([1, 2, 3, 4]);

            await passToKey({ pass: mockPass, salt });

            const deriveKeyCall = mockDeriveKey.mock.calls[0][0];
            expect(deriveKeyCall.hash).toBe("SHA-512");
        });
    });

    describe("encryptPrivateKey", () => {
        test("should throw error when not in browser environment", async () => {
            const originalWindow = global.window;
            // @ts-expect-error - Simulating non-browser environment
            delete global.window;

            vi.resetModules();
            const { encryptPrivateKey } = await import("./encrypt");

            await expect(
                encryptPrivateKey({
                    privateKey: mockPrivateKey,
                    initialAddress: mockAddress,
                    pass: mockPass,
                })
            ).rejects.toThrow(
                "This function should only be used in the browser"
            );

            global.window = originalWindow;
        });

        test("should generate random IV and salt", async () => {
            const { encryptPrivateKey } = await import("./encrypt");

            await encryptPrivateKey({
                privateKey: mockPrivateKey,
                initialAddress: mockAddress,
                pass: mockPass,
            });

            expect(mockGetRandomValues).toHaveBeenCalled();
        });

        test("should encrypt private key using AES-GCM", async () => {
            const { encryptPrivateKey } = await import("./encrypt");

            await encryptPrivateKey({
                privateKey: mockPrivateKey,
                initialAddress: mockAddress,
                pass: mockPass,
            });

            expect(mockEncrypt).toHaveBeenCalledWith(
                {
                    name: "AES-GCM",
                    iv: expect.any(Uint8Array),
                },
                expect.anything(),
                expect.any(Uint8Array)
            );
        });

        test("should return base64url encoded result", async () => {
            const { encryptPrivateKey } = await import("./encrypt");

            const result = await encryptPrivateKey({
                privateKey: mockPrivateKey,
                initialAddress: mockAddress,
                pass: mockPass,
            });

            expect(typeof result).toBe("string");
            expect(result).not.toMatch(/[+/]/);
        });

        test("should include wallet address hash in salt", async () => {
            const { encryptPrivateKey } = await import("./encrypt");

            await encryptPrivateKey({
                privateKey: mockPrivateKey,
                initialAddress: mockAddress,
                pass: mockPass,
            });

            expect(mockDeriveKey).toHaveBeenCalled();
        });

        test("should produce different output for different passwords", async () => {
            const { encryptPrivateKey } = await import("./encrypt");

            const result1 = await encryptPrivateKey({
                privateKey: mockPrivateKey,
                initialAddress: mockAddress,
                pass: "password1",
            });

            mockGetRandomValues.mockImplementation((array: Uint8Array) => {
                for (let i = 0; i < array.length; i++) {
                    array[i] = (i + 100) % 256;
                }
                return array;
            });

            const result2 = await encryptPrivateKey({
                privateKey: mockPrivateKey,
                initialAddress: mockAddress,
                pass: "password2",
            });

            expect(result1).not.toBe(result2);
        });
    });
});
