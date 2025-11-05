import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import {
    mockAll,
    oxMocks,
    permissionlessActionsMocks,
} from "../../../../test/mock";
import type { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";
import { WebAuthNService } from "./WebAuthNService";

describe("WebAuthNService", () => {
    // Setup all the mocks needed for this test
    beforeAll(() => {
        mockAll();

        permissionlessActionsMocks.getSenderAddress.mockImplementation(() =>
            Promise.resolve("0x1234567890abcdef1234567890abcdef12345678")
        );

        oxMocks.WebAuthnP256.verify.mockImplementation(() => true);
    });

    // Restore all the mocks after the test
    afterAll(() => {
        mock.restore();
    });

    const mockAuthenticatorRepository: AuthenticatorRepository = {
        getByCredentialId: mock(() =>
            Promise.resolve({
                _id: "test-credential-id",
                counter: 4,
                publicKey: { x: "0x123", y: "0x456" },
                credentialPublicKey: { buffer: new ArrayBuffer(8) },
                transports: ["usb", "nfc"],
            })
        ),
        updateCounter: mock(() => Promise.resolve()),
    } as unknown as AuthenticatorRepository;

    const webAuthNService = new WebAuthNService(mockAuthenticatorRepository);

    describe("parseCompressedResponse", () => {
        it("should parse base64 encoded JSON response", () => {
            const testData = { test: "data", number: 123 };
            const encoded = Buffer.from(JSON.stringify(testData)).toString(
                "base64"
            );

            const result = webAuthNService.parseCompressedResponse(encoded);

            expect(result).toEqual(testData);
        });

        it("should handle empty object", () => {
            const testData = {};
            const encoded = Buffer.from(JSON.stringify(testData)).toString(
                "base64"
            );

            const result = webAuthNService.parseCompressedResponse(encoded);

            expect(result).toEqual(testData);
        });
    });

    describe("getWalletAddress", () => {
        it("should return a valid wallet address", async () => {
            const authenticatorId = "test-authenticator";
            const pubKey = { x: "0x123" as const, y: "0x456" as const };

            const result = await webAuthNService.getWalletAddress({
                authenticatorId,
                pubKey,
            });

            expect(result).toBe("0x1234567890abcdef1234567890abcdef12345678");
        });
    });

    describe("getEcdsaWalletAddress", () => {
        it("should return a valid ECDSA wallet address", async () => {
            const ecdsaAddress =
                "0x1234567890abcdef1234567890abcdef12345678" as const;

            const result = await webAuthNService.getEcdsaWalletAddress({
                ecdsaAddress,
            });

            expect(result).toBe("0x1234567890abcdef1234567890abcdef12345678");
        });
    });

    describe("isValidSignature", () => {
        it("should return false when authenticator is not found", async () => {
            const mockRepo = {
                ...mockAuthenticatorRepository,
                getByCredentialId: mock(() => Promise.resolve(null)),
            } as unknown as AuthenticatorRepository;
            const service = new WebAuthNService(mockRepo);

            const compressedSignature = Buffer.from(
                JSON.stringify({
                    id: "non-existent-id",
                })
            ).toString("base64");

            const result = await service.isValidSignature({
                compressedSignature,
                challenge: "0x1234567890abcdef",
            });

            expect(result).toBe(false);
        });

        it("should return signature verification details when valid", async () => {
            // Create mock signature using ox format (what the service now expects)
            const mockSignature = {
                id: "test-credential-id",
                response: {
                    signature: {
                        r: 123456789n,
                        s: 987654321n,
                        yParity: 0,
                    },
                    metadata: {
                        challenge: "test-challenge",
                        origin: "https://test.com",
                        type: "webauthn.get" as const,
                        authenticatorData: new Uint8Array([1, 2, 3]),
                        clientDataJSON: new Uint8Array([4, 5, 6]),
                    },
                },
            };

            const compressedSignature = Buffer.from(
                JSON.stringify(mockSignature, (_, v) =>
                    typeof v === "bigint" ? v.toString() : v
                )
            ).toString("base64");

            const result = await webAuthNService.isValidSignature({
                compressedSignature,
                challenge: "0x1234567890abcdef",
            });

            expect(result).toEqual({
                authenticatorId: "test-credential-id",
                address: "0x1234567890abcdef1234567890abcdef12345678",
                publicKey: { x: "0x123", y: "0x456" },
                rawPublicKey: expect.any(ArrayBuffer),
                transports: ["usb", "nfc"],
            });
        });

        it("should return false when signature verification fails", async () => {
            // Mock the verify function to return false for this test
            oxMocks.WebAuthnP256.verify.mockImplementationOnce(() => false);

            // Create mock signature with invalid values that will fail verification
            const mockSignature = {
                id: "test-credential-id",
                response: {
                    signature: {
                        r: 0n,
                        s: 0n,
                        yParity: 0,
                    },
                    metadata: {
                        challenge: "invalid-challenge",
                        origin: "https://malicious.com",
                        type: "webauthn.get" as const,
                        authenticatorData: new Uint8Array([]),
                        clientDataJSON: new Uint8Array([]),
                    },
                },
            };

            const compressedSignature = Buffer.from(
                JSON.stringify(mockSignature, (_, v) =>
                    typeof v === "bigint" ? v.toString() : v
                )
            ).toString("base64");

            const result = await webAuthNService.isValidSignature({
                compressedSignature,
                challenge: "0x1234567890abcdef",
            });

            // Should return false when verification fails
            expect(result).toBe(false);
        });
    });
});
