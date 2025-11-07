import type { Hex } from "viem";
import { describe, expect, test } from "../../../tests/vitest-fixtures";

describe("webAuthN utilities", () => {
    describe("formatSignature", () => {
        test("should format signature with all components", async () => {
            const { formatSignature } = await import("./webAuthN");

            const signatureData = {
                authenticatorIdHash:
                    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex,
                rs: [
                    BigInt(
                        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
                    ),
                    BigInt(
                        "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
                    ),
                ] as [bigint, bigint],
                challengeOffset: 123n,
                authenticatorData: "0xauthdata" as Hex,
                clientData: "0xclientdata" as Hex,
            };

            const result = formatSignature(signatureData);

            expect(result).toBeDefined();
            expect(result.startsWith("0x")).toBe(true);
            expect(result.length).toBeGreaterThan(2);
        });

        test("should produce consistent output for same inputs", async () => {
            const { formatSignature } = await import("./webAuthN");

            const signatureData = {
                authenticatorIdHash:
                    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex,
                rs: [BigInt(100), BigInt(200)] as [bigint, bigint],
                challengeOffset: 50n,
                authenticatorData: "0xauthdata" as Hex,
                clientData: "0xclientdata" as Hex,
            };

            const result1 = formatSignature(signatureData);
            const result2 = formatSignature(signatureData);

            expect(result1).toBe(result2);
        });

        test("should handle different authenticator ID hashes", async () => {
            const { formatSignature } = await import("./webAuthN");

            const base = {
                rs: [BigInt(100), BigInt(200)] as [bigint, bigint],
                challengeOffset: 50n,
                authenticatorData: "0xauth" as Hex,
                clientData: "0xclient" as Hex,
            };

            const result1 = formatSignature({
                ...base,
                authenticatorIdHash:
                    "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex,
            });
            const result2 = formatSignature({
                ...base,
                authenticatorIdHash:
                    "0x2222222222222222222222222222222222222222222222222222222222222222" as Hex,
            });

            expect(result1).not.toBe(result2);
        });
    });

    describe("getStubSignature", () => {
        test("should generate stub signature", async () => {
            const { getStubSignature } = await import("./webAuthN");

            const authenticatorIdHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;

            const result = getStubSignature({ authenticatorIdHash });

            expect(result).toBeDefined();
            expect(result.startsWith("0x")).toBe(true);
        });

        test("should use max values for signature components", async () => {
            const { getStubSignature } = await import("./webAuthN");

            const authenticatorIdHash = "0x1234" as Hex;
            const result = getStubSignature({ authenticatorIdHash });

            // Stub signature should be quite long due to max values
            expect(result.length).toBeGreaterThan(100);
        });

        test("should produce consistent output for same authenticator ID", async () => {
            const { getStubSignature } = await import("./webAuthN");

            const authenticatorIdHash = "0xabcd" as Hex;

            const result1 = getStubSignature({ authenticatorIdHash });
            const result2 = getStubSignature({ authenticatorIdHash });

            expect(result1).toBe(result2);
        });
    });
});
