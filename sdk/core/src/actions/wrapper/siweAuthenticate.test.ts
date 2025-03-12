/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    FrakClient,
    ModalRpcMetadata,
    ModalRpcStepsResultType,
    ModalStepTypes,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "../../types";
import { displayModal } from "../displayModal";
import { siweAuthenticate } from "./siweAuthenticate";

// Mock dependencies
vi.mock("../displayModal", () => ({
    displayModal: vi.fn(),
}));

vi.mock("viem/siwe", () => ({
    generateSiweNonce: vi.fn().mockReturnValue("mock-nonce"),
}));

describe("siweAuthenticate", () => {
    // Mock client
    const mockClientMetadataName = "My App";
    const mockClient: FrakClient = {
        config: {
            metadata: {
                name: mockClientMetadataName,
            },
            domain: "test-domain.com",
        },
    } as unknown as FrakClient;

    // Mock SIWE result
    const mockSiweResult: SiweAuthenticateReturnType = {
        message: "mock-siwe-message",
        signature: "0xabcdef1234567890",
    };

    // Mock displayModal result
    const mockModalResult = {
        login: { wallet: "0x123" },
        siweAuthenticate: mockSiweResult,
    } as unknown as ModalRpcStepsResultType<ModalStepTypes[]>;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(displayModal).mockResolvedValue(mockModalResult);

        // Mock window.location.host
        Object.defineProperty(window, "location", {
            value: {
                host: "test-window-domain.com",
            },
            writable: true,
        });
    });

    it("should call displayModal with correct parameters", async () => {
        // Execute
        await siweAuthenticate(mockClient, {});

        // Verify with more flexible matching
        expect(displayModal).toHaveBeenCalledWith(
            mockClient,
            expect.objectContaining({
                metadata: undefined,
                steps: expect.objectContaining({
                    login: {},
                    siweAuthenticate: expect.objectContaining({
                        siwe: expect.objectContaining({
                            statement: `I confirm that I want to use my Frak wallet on: ${mockClientMetadataName}`,
                            domain: "test-domain.com",
                            uri: "https://test-domain.com",
                            version: "1",
                        }),
                    }),
                }),
            })
        );
    });

    it("should return only the siweAuthenticate part of the result", async () => {
        // Execute
        const result = await siweAuthenticate(mockClient, {});

        // Verify
        expect(result).toEqual(mockSiweResult);
        expect(result).toBe(mockModalResult.siweAuthenticate);
    });

    it("should use custom SIWE parameters when provided", async () => {
        // Setup - custom SIWE params
        const customSiwe: Partial<SiweAuthenticationParams> = {
            statement: "Custom statement for testing",
            nonce: "custom-nonce",
            uri: "https://custom-uri.com",
            version: "1",
            expirationTimeTimestamp: 1234567890,
            // Don't include domain so it merges correctly
        };

        // Execute
        await siweAuthenticate(mockClient, { siwe: customSiwe });

        // Verify with more flexible matching
        expect(displayModal).toHaveBeenCalledWith(
            mockClient,
            expect.objectContaining({
                metadata: undefined,
                steps: expect.objectContaining({
                    login: {},
                    siweAuthenticate: expect.objectContaining({
                        siwe: expect.objectContaining({
                            statement: "Custom statement for testing",
                            nonce: "custom-nonce",
                            uri: "https://custom-uri.com",
                            version: "1",
                            expirationTimeTimestamp: 1234567890,
                            domain: "test-domain.com", // From client config
                        }),
                    }),
                }),
            })
        );
    });

    it("should use window.location.host when client domain is not provided", async () => {
        // Setup - client without domain
        const clientWithoutDomain: FrakClient = {
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // Execute
        await siweAuthenticate(clientWithoutDomain, {});

        // Expected SIWE params using window.location.host
        expect(displayModal).toHaveBeenCalledWith(
            clientWithoutDomain,
            expect.objectContaining({
                steps: expect.objectContaining({
                    siweAuthenticate: expect.objectContaining({
                        siwe: expect.objectContaining({
                            domain: "test-window-domain.com",
                            uri: "https://test-window-domain.com",
                        }),
                    }),
                }),
            })
        );
    });

    it("should pass custom metadata to displayModal", async () => {
        // Setup - custom metadata
        const customMetadata: ModalRpcMetadata = {
            lang: "fr" as const,
            header: {
                title: "Custom Authentication",
                icon: "https://example.com/icon.png",
            },
            context: "Authentication context",
        };

        // Execute
        await siweAuthenticate(mockClient, {
            metadata: customMetadata,
        });

        // Verify
        expect(displayModal).toHaveBeenCalledWith(mockClient, {
            metadata: customMetadata,
            steps: expect.any(Object),
        });
    });

    it("should forward errors from displayModal", async () => {
        // Setup - mock error
        const mockError = new Error("Authentication failed");
        vi.mocked(displayModal).mockRejectedValue(mockError);

        // Execute and verify
        await expect(siweAuthenticate(mockClient, {})).rejects.toThrow(
            mockError
        );
    });
});
