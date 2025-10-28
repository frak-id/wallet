import type { Address, Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { AccountMetadata } from "./signature";

vi.mock("@simplewebauthn/browser", () => ({
    startAuthentication: vi.fn(),
}));

vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

vi.mock("../../stores/authenticationStore", () => ({
    authenticationStore: {
        getState: vi.fn(),
    },
}));

vi.mock("../action/signOptions", () => ({
    getSignOptions: vi.fn(),
}));

vi.mock("./webAuthN", () => ({
    parseWebAuthNAuthentication: vi.fn(),
    formatSignature: vi.fn(),
}));

describe("signature utilities", () => {
    describe("wrapMessageForSignature", () => {
        it("should wrap message with domain separator", async () => {
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

        it("should produce consistent output for same inputs", async () => {
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

        it("should handle different chain IDs", async () => {
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
        it("should fetch metadata from contract", async () => {
            const { fetchAccountMetadata } = await import("./signature");
            const { readContract } = await import("viem/actions");

            const mockClient = {
                chain: { id: 1 },
            } as any;
            const mockAddress: Address =
                "0x1234567890123456789012345678901234567890";

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

        it("should return defaults when contract read fails", async () => {
            const { fetchAccountMetadata } = await import("./signature");
            const { readContract } = await import("viem/actions");

            const mockClient = {
                chain: { id: 137 },
            } as any;
            const mockAddress: Address =
                "0xabcdef1234567890abcdef1234567890abcdef12";

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

        it("should use chain ID from client", async () => {
            const { fetchAccountMetadata } = await import("./signature");
            const { readContract } = await import("viem/actions");

            const mockClient = {
                chain: { id: 8453 },
            } as any;
            const mockAddress: Address =
                "0x1111111111111111111111111111111111111111";

            vi.mocked(readContract).mockRejectedValue(new Error("No contract"));

            const metadata = await fetchAccountMetadata(
                mockClient,
                mockAddress
            );

            expect(metadata.chainId).toBe(8453n);
        });
    });

    describe("signHashViaWebAuthN", () => {
        it("should sign hash successfully", async () => {
            const { signHashViaWebAuthN } = await import("./signature");
            const { startAuthentication } = await import(
                "@simplewebauthn/browser"
            );
            const { getSignOptions } = await import("../action/signOptions");
            const { parseWebAuthNAuthentication, formatSignature } =
                await import("./webAuthN");
            const { authenticationStore } = await import(
                "../../stores/authenticationStore"
            );

            const mockWallet = {
                type: "webauthn" as const,
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
                publicKey: {
                    x: "0xabc" as `0x${string}`,
                    y: "0xdef" as `0x${string}`,
                },
                authenticatorId: "auth-id",
                token: "token",
            };

            const mockOptions = {
                challenge: "challenge-123",
                rpId: "test.frak.id",
            };

            const mockAuthResponse = {
                id: "cred-id",
                response: {},
            };

            const mockParsedAuth = {
                authenticatorData: "0xauthdata" as Hex,
                clientData: "0xclientdata" as Hex,
                challengeOffset: 10n,
                signature: { r: "0x123", s: "0x456" },
            };

            const mockFormattedSignature: Address =
                "0xformattedsignature1234567890abcdef12345678";
            const setLastWebAuthNAction = vi.fn();

            vi.mocked(getSignOptions).mockResolvedValue(mockOptions as any);
            vi.mocked(startAuthentication).mockResolvedValue(
                mockAuthResponse as any
            );
            vi.mocked(parseWebAuthNAuthentication).mockReturnValue(
                mockParsedAuth as any
            );
            vi.mocked(formatSignature).mockReturnValue(mockFormattedSignature);
            vi.mocked(authenticationStore.getState).mockReturnValue({
                setLastWebAuthNAction,
            } as any);

            const result = await signHashViaWebAuthN({
                hash: "0xhash" as Hex,
                wallet: mockWallet,
            });

            expect(result).toBe(mockFormattedSignature);
            expect(getSignOptions).toHaveBeenCalledWith({
                authenticatorId: "auth-id",
                toSign: "0xhash",
            });
            expect(startAuthentication).toHaveBeenCalledWith({
                optionsJSON: mockOptions,
            });
            expect(setLastWebAuthNAction).toHaveBeenCalledWith({
                wallet: mockWallet.address,
                signature: mockAuthResponse,
                msg: mockOptions.challenge,
            });
        });
    });
});
