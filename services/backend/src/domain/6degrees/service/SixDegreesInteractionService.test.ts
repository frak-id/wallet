import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Hex } from "viem";
import type { KyInstance } from "ky";
import type { AuthenticatorRepository } from "../../../domain/auth/repositories/AuthenticatorRepository";
import { SixDegreesInteractionService } from "./SixDegreesInteractionService";

describe("SixDegreesInteractionService", () => {
    let service: SixDegreesInteractionService;
    let mockAuthenticatorRepository: any;
    let mockApi: any;

    const mockUserToken = "mock-bearer-token";
    const mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678" as Hex;
    const mockCredentialPublicKey = {
        buffer: new ArrayBuffer(64),
    };

    /* -------------------------------------------------------------------------- */
    /*                                    Mocks                                   */
    /* -------------------------------------------------------------------------- */

    mock.module("@backend-common", () => ({
        log: {
            warn: mock(() => {}),
        },
    }));

    mock.module("@frak-labs/app-essentials", () => ({
        WebAuthN: {
            rpId: "example.com",
            rpOrigin: "https://example.com",
        },
    }));

    mock.module("@frak-labs/core-sdk", () => ({
        productTypes: {
            referral: "0x01",
            webshop: "0x02", 
            press: "0x03",
        },
        interactionTypes: {
            referral: {
                referred: "0x1234",
            },
        },
    }));

    /* -------------------------------------------------------------------------- */
    /*                                    Setup                                   */
    /* -------------------------------------------------------------------------- */

    beforeEach(() => {
        mockApi = {
            post: mock(() => Promise.resolve()),
        };

        mockAuthenticatorRepository = {
            getByWallet: mock(() =>
                Promise.resolve({
                    credentialPublicKey: mockCredentialPublicKey,
                })
            ),
        };

        service = new SixDegreesInteractionService(mockApi, mockAuthenticatorRepository);
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("pushInteraction", () => {
        it("should successfully push login interactions", async () => {
            const interactions = [
                {
                    handlerTypeDenominator: "0x02" as Hex, // webshop type
                    interactionData: "0x5678" as Hex, // non-referral interaction
                },
            ];

            await service.pushInteraction(interactions, mockUserToken);

            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/interactions", {
                json: {
                    type: "login",
                    context: {
                        rpId: "example.com",
                        rpOrigin: "https://example.com",
                        domain: "example.com",
                    },
                },
                headers: {
                    Authorization: `Bearer ${mockUserToken}`,
                },
            });
        });

        it("should successfully push referral interactions", async () => {
            const interactions = [
                {
                    handlerTypeDenominator: "0x01" as Hex, // referral type
                    interactionData: `0x1234${"0".repeat(56)}${mockWalletAddress.slice(2)}` as Hex, // referral interaction with wallet
                },
            ];

            await service.pushInteraction(interactions, mockUserToken);

            expect(mockAuthenticatorRepository.getByWallet).toHaveBeenCalledWith({
                wallet: expect.any(String),
            });

            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/interactions", {
                json: {
                    type: "referred",
                    referrerPublicKey: expect.any(String),
                    context: {
                        rpId: "example.com",
                        rpOrigin: "https://example.com",
                        domain: "example.com",
                    },
                },
                headers: {
                    Authorization: `Bearer ${mockUserToken}`,
                },
            });
        });

        it("should filter out unknown handler types", async () => {
            const interactions = [
                {
                    handlerTypeDenominator: "0x99" as Hex, // unknown type
                    interactionData: "0x5678" as Hex,
                },
            ];

            await service.pushInteraction(interactions, mockUserToken);

            expect(mockApi.post).not.toHaveBeenCalled();
        });

        it("should handle API errors gracefully", async () => {
            mockApi.post = mock(() => Promise.reject(new Error("API Error")));

            const interactions = [
                {
                    handlerTypeDenominator: "0x02" as Hex, // webshop type
                    interactionData: "0x5678" as Hex,
                },
            ];

            // Should not throw
            expect(
                service.pushInteraction(interactions, mockUserToken)
            ).resolves.toBeUndefined();
        });

        it("should handle missing authenticator for referral", async () => {
            mockAuthenticatorRepository.getByWallet = mock(() => Promise.resolve(null));

            const interactions = [
                {
                    handlerTypeDenominator: "0x01" as Hex, // referral type
                    interactionData: `0x1234${"0".repeat(56)}${mockWalletAddress.slice(2)}` as Hex,
                },
            ];

            await service.pushInteraction(interactions, mockUserToken);

            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/interactions", {
                json: {
                    type: "login", // Should fallback to login when authenticator not found
                    context: {
                        rpId: "example.com",
                        rpOrigin: "https://example.com",
                        domain: "example.com",
                    },
                },
                headers: {
                    Authorization: `Bearer ${mockUserToken}`,
                },
            });
        });

        it("should handle authenticator repository errors", async () => {
            mockAuthenticatorRepository.getByWallet = mock(() =>
                Promise.reject(new Error("Repository error"))
            );

            const interactions = [
                {
                    handlerTypeDenominator: "0x01" as Hex, // referral type
                    interactionData: `0x1234${"0".repeat(56)}${mockWalletAddress.slice(2)}` as Hex,
                },
            ];

            await service.pushInteraction(interactions, mockUserToken);

            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/interactions", {
                json: {
                    type: "login", // Should fallback to login on error
                    context: {
                        rpId: "example.com",
                        rpOrigin: "https://example.com",
                        domain: "example.com",
                    },
                },
                headers: {
                    Authorization: `Bearer ${mockUserToken}`,
                },
            });
        });

        it("should process multiple interactions", async () => {
            const interactions = [
                {
                    handlerTypeDenominator: "0x02" as Hex, // webshop
                    interactionData: "0x5678" as Hex,
                },
                {
                    handlerTypeDenominator: "0x03" as Hex, // press
                    interactionData: "0x9abc" as Hex,
                },
            ];

            await service.pushInteraction(interactions, mockUserToken);

            expect(mockApi.post).toHaveBeenCalledTimes(2);
        });

        it("should convert credential public key to base64", async () => {
            const testBuffer = new ArrayBuffer(8);
            const testView = new Uint8Array(testBuffer);
            testView.set([1, 2, 3, 4, 5, 6, 7, 8]);

            mockAuthenticatorRepository.getByWallet = mock(() =>
                Promise.resolve({
                    credentialPublicKey: { buffer: testBuffer },
                })
            );

            const interactions = [
                {
                    handlerTypeDenominator: "0x01" as Hex, // referral type
                    interactionData: `0x1234${"0".repeat(56)}${mockWalletAddress.slice(2)}` as Hex,
                },
            ];

            await service.pushInteraction(interactions, mockUserToken);

            const expectedBase64 = Buffer.from(testBuffer).toString("base64");
            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/interactions", {
                json: {
                    type: "referred",
                    referrerPublicKey: expectedBase64,
                    context: {
                        rpId: "example.com",
                        rpOrigin: "https://example.com",
                        domain: "example.com",
                    },
                },
                headers: {
                    Authorization: `Bearer ${mockUserToken}`,
                },
            });
        });
    });
});