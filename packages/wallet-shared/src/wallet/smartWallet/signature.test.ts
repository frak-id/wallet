import type { Address, Hex } from "viem";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { describe, expect, test } from "../../../tests/vitest-fixtures";
import type { AccountMetadata } from "./signature";

vi.mock("ox", () => ({
    WebAuthnP256: {
        sign: vi.fn(),
    },
}));

vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

vi.mock("../../stores/authenticationStore", () => ({
    authenticationStore: {
        getState: vi.fn(),
    },
}));

vi.mock("./webAuthN", () => ({
    formatSignature: vi.fn(),
}));

describe("signature utilities", () => {
    describe("wrapMessageForSignature", () => {
        test("should wrap message with domain separator", async () => {
            const { wrapMessageForSignature } = await import("./signature");

            const message: Hex = "0x1234";
            const metadata: AccountMetadata = {
                name: "Kernel",
                version: "0.2.4",
                chainId: 1n,
                verifyingContract:
                    "0x1234567890123456789012345678901234567890" as Address,
            };

            const result = wrapMessageForSignature({ message, metadata });

            expect(result).toBeDefined();
            expect(result.startsWith("0x")).toBe(true);
        });

        test("should produce consistent output for same inputs", async () => {
            const { wrapMessageForSignature } = await import("./signature");

            const message: Hex = "0xabcd";
            const metadata: AccountMetadata = {
                name: "Kernel",
                version: "0.2.4",
                chainId: 1n,
                verifyingContract:
                    "0xabcdef1234567890abcdef1234567890abcdef12" as Address,
            };

            const result1 = wrapMessageForSignature({ message, metadata });
            const result2 = wrapMessageForSignature({ message, metadata });

            expect(result1).toBe(result2);
        });

        test("should handle different chain IDs", async () => {
            const { wrapMessageForSignature } = await import("./signature");

            const message: Hex = "0x5678";
            const metadata1: AccountMetadata = {
                name: "Kernel",
                version: "0.2.4",
                chainId: 1n,
                verifyingContract:
                    "0x1234567890123456789012345678901234567890" as Address,
            };
            const metadata2: AccountMetadata = {
                ...metadata1,
                chainId: 137n,
            };

            const result1 = wrapMessageForSignature({
                message,
                metadata: metadata1,
            });
            const result2 = wrapMessageForSignature({
                message,
                metadata: metadata2,
            });

            expect(result1).not.toBe(result2);
        });
    });

    describe("fetchAccountMetadata", () => {
        test("should fetch metadata from contract", async ({ mockAddress }) => {
            const { fetchAccountMetadata } = await import("./signature");
            const { readContract } = await import("viem/actions");

            const mockClient = {
                chain: { id: 1 },
            } as any;

            const mockResult = [
                "0x00",
                "CustomKernel",
                "1.0.0",
                1n,
                mockAddress,
                "0x00",
                [],
            ];

            vi.mocked(readContract).mockResolvedValue(mockResult as any);

            const metadata = await fetchAccountMetadata(
                mockClient,
                mockAddress
            );

            expect(metadata).toEqual({
                name: "CustomKernel",
                version: "1.0.0",
                chainId: 1n,
                verifyingContract: mockAddress,
            });
        });

        test("should return defaults when contract read fails", async () => {
            const { fetchAccountMetadata } = await import("./signature");
            const { readContract } = await import("viem/actions");
            const { createMockAddress } = await import("../../test/factories");

            const mockClient = {
                chain: { id: 137 },
            } as any;
            const mockAddress = createMockAddress("abcdef");

            vi.mocked(readContract).mockRejectedValue(new Error("Read failed"));

            const metadata = await fetchAccountMetadata(
                mockClient,
                mockAddress
            );

            expect(metadata).toEqual({
                name: "Kernel",
                version: "0.2.4",
                chainId: 137n,
                verifyingContract: mockAddress,
            });
        });

        test("should use chain ID from client", async () => {
            const { fetchAccountMetadata } = await import("./signature");
            const { readContract } = await import("viem/actions");
            const { createMockAddress } = await import("../../test/factories");

            const mockClient = {
                chain: { id: 8453 },
            } as any;
            const mockAddress = createMockAddress("1111");

            vi.mocked(readContract).mockRejectedValue(new Error("No contract"));

            const metadata = await fetchAccountMetadata(
                mockClient,
                mockAddress
            );

            expect(metadata.chainId).toBe(8453n);
        });
    });

    describe("signHashViaWebAuthN", () => {
        test("should sign hash successfully", async () => {
            const { signHashViaWebAuthN } = await import("./signature");
            const { WebAuthnP256 } = await import("ox");
            const { formatSignature } = await import("./webAuthN");
            const { authenticationStore } = await import(
                "../../stores/authenticationStore"
            );
            const { createMockWebAuthNWallet } = await import(
                "../../test/factories"
            );

            const mockWallet = createMockWebAuthNWallet({
                token: "token",
            });

            const mockOxResponse = {
                metadata: {
                    credentialId: "cred-id",
                    authenticatorData: "0xauthdata" as Hex,
                    clientDataJSON: "0xclientdata" as Hex,
                    challengeIndex: 10,
                },
                signature: {
                    r: 123n,
                    s: 456n,
                },
                raw: {
                    id: "cred-id",
                },
            };

            const mockFormattedSignature: Address =
                "0xformattedsignature1234567890abcdef12345678";
            const setLastWebAuthNAction = vi.fn();

            vi.mocked(WebAuthnP256.sign).mockResolvedValue(
                mockOxResponse as any
            );
            vi.mocked(formatSignature).mockReturnValue(mockFormattedSignature);
            vi.mocked(authenticationStore.getState).mockReturnValue({
                setLastWebAuthNAction,
            } as any);

            const result = await signHashViaWebAuthN({
                hash: "0xhash" as Hex,
                wallet: mockWallet as import("../../types/WebAuthN").WebAuthNWallet,
            });

            expect(result).toBe(mockFormattedSignature);
            expect(WebAuthnP256.sign).toHaveBeenCalledWith({
                challenge: "0xhash",
                credentialId: "auth-id",
            });
            expect(setLastWebAuthNAction).toHaveBeenCalledWith({
                wallet: mockWallet.address,
                signature: {
                    id: "cred-id",
                    response: {
                        metadata: mockOxResponse.metadata,
                        signature: mockOxResponse.signature,
                    },
                },
                challenge: "0xhash",
            });
        });
    });
});
