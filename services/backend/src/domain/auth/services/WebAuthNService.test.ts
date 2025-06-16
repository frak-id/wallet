import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type {
    AuthenticationResponseJSON,
    VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { mockAll } from "../../../__mock__";
import { permissionlessActionsMocks } from "../../../__mock__/viem";
import { webauthnMocks } from "../../../__mock__/webauthn";
import type { AuthenticatorRepository } from "../repositories/AuthenticatorRepository";
import { WebAuthNService } from "./WebAuthNService";

describe("WebAuthNService", () => {
    // Setup all the mocks needed for this test
    beforeAll(() => {
        mockAll();

        webauthnMocks.verifyAuthenticationResponse.mockImplementation(() =>
            Promise.resolve({
                verified: true,
                authenticationInfo: {
                    newCounter: 5,
                },
            } as unknown as VerifiedAuthenticationResponse)
        );

        permissionlessActionsMocks.getSenderAddress.mockImplementation(() =>
            Promise.resolve("0x1234567890abcdef1234567890abcdef12345678")
        );
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
                msg: "test-message",
            });

            expect(result).toBe(false);
        });

        it("should return signature verification details when valid", async () => {
            const mockSignature: AuthenticationResponseJSON = {
                id: "test-credential-id",
                rawId: "test-raw-id",
                response: {
                    clientDataJSON: "test-client-data",
                    authenticatorData: "test-auth-data",
                    signature: "test-signature",
                },
                type: "public-key",
                clientExtensionResults: {},
            };

            const compressedSignature = Buffer.from(
                JSON.stringify(mockSignature)
            ).toString("base64");

            const result = await webAuthNService.isValidSignature({
                compressedSignature,
                msg: "test-message",
            });

            expect(result).toEqual({
                authenticatorId: "test-credential-id",
                address: "0x1234567890abcdef1234567890abcdef12345678",
                publicKey: { x: "0x123", y: "0x456" },
                rawPublicKey: expect.any(ArrayBuffer),
                transports: ["usb", "nfc"],
            });
        });

        it("should update counter when verification counter has changed", async () => {
            const updateCounterSpy = mock(() => Promise.resolve());
            const mockRepo = {
                ...mockAuthenticatorRepository,
                updateCounter: updateCounterSpy,
            } as unknown as AuthenticatorRepository;
            const service = new WebAuthNService(mockRepo);

            const mockSignature: AuthenticationResponseJSON = {
                id: "test-credential-id",
                rawId: "test-raw-id",
                response: {
                    clientDataJSON: "test-client-data",
                    authenticatorData: "test-auth-data",
                    signature: "test-signature",
                },
                type: "public-key",
                clientExtensionResults: {},
            };

            const compressedSignature = Buffer.from(
                JSON.stringify(mockSignature)
            ).toString("base64");

            await service.isValidSignature({
                compressedSignature,
                msg: "test-message",
            });

            expect(updateCounterSpy).toHaveBeenCalledWith({
                credentialId: "test-credential-id",
                counter: 6, // newCounter (5) + 1
            });
        });
    });
});
