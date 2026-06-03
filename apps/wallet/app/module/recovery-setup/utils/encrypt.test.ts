import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

describe("encrypt utilities", () => {
    const mockPass = "securePassword123";

    let mockImportKey: ReturnType<typeof vi.fn>;
    let mockDeriveKey: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockImportKey = vi.fn().mockResolvedValue({ type: "secret" });
        mockDeriveKey = vi.fn().mockResolvedValue({ type: "derived" });

        Object.defineProperty(global, "window", {
            value: {
                crypto: {
                    subtle: {
                        importKey: mockImportKey,
                        deriveKey: mockDeriveKey,
                    },
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
});
