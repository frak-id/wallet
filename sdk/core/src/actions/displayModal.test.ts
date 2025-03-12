/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type {
    DisplayModalParamsType,
    FrakClient,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "../types";
import { displayModal } from "./displayModal";

describe("displayModal", () => {
    // Mock client metadata
    const mockClientMetadataName = "My App";

    // Mock modal result
    const mockModalResult = {
        login: { wallet: "0x123" },
        openSession: {
            startTimestamp: 1000,
            endTimestamp: 2000,
        },
    } as unknown as ModalRpcStepsResultType<ModalStepTypes[]>;

    it("should call client request with correct parameters for simple modal", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockModalResult),
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // Simple modal params
        const modalParams = {
            steps: {
                login: { allowSso: false },
                openSession: {},
            },
        } as DisplayModalParamsType<ModalStepTypes[]>;

        // Execute
        const result = await displayModal(mockClient, modalParams);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_displayModal",
            params: [modalParams.steps, mockClientMetadataName, undefined],
        });
        expect(result).toEqual(mockModalResult);
    });

    it("should call client request with correct parameters for complex modal", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockModalResult),
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // Complex modal params
        const modalParams = {
            steps: {
                login: {
                    allowSso: true,
                    ssoMetadata: {
                        logoUrl: "https://example.com/logo.png",
                        homepageLink: "https://example.com",
                    },
                },
                openSession: {},
                final: {
                    action: { key: "reward" },
                    autoSkip: true,
                },
            },
            metadata: {
                header: {
                    title: "Test App",
                    icon: "https://example.com/icon.png",
                },
                context: "Test context",
                lang: "en",
            },
        } as DisplayModalParamsType<ModalStepTypes[]>;

        // Execute
        await displayModal(mockClient, modalParams);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_displayModal",
            params: [
                modalParams.steps,
                mockClientMetadataName,
                modalParams.metadata,
            ],
        });
    });

    it("should forward client errors", async () => {
        // Mock error
        const mockError = new Error("RPC error");

        // Mock client with error
        const mockClient: FrakClient = {
            request: vi.fn().mockRejectedValue(mockError),
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // Simple modal params
        const modalParams = {
            steps: {
                login: { allowSso: false },
            },
        } as DisplayModalParamsType<ModalStepTypes[]>;

        // Execute and verify error is thrown
        await expect(displayModal(mockClient, modalParams)).rejects.toThrow(
            mockError
        );
    });

    it("should handle transactions steps", async () => {
        // Mock transaction result
        const mockTxResult = {
            login: { wallet: "0x123" },
            sendTransaction: {
                hash: "0xabc",
                receipt: { status: 1 },
            },
        };

        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockTxResult),
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // Transaction modal params
        const modalParams = {
            steps: {
                login: { allowSso: false },
                sendTransaction: {
                    tx: [{ to: "0xdeadbeef", data: "0xdeadbeef" }],
                },
            },
        } as DisplayModalParamsType<ModalStepTypes[]>;

        // Execute
        const result = await displayModal(mockClient, modalParams);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_displayModal",
            params: [modalParams.steps, mockClientMetadataName, undefined],
        });
        expect(result).toEqual(mockTxResult);
    });

    it("should handle SIWE authentication steps", async () => {
        // Mock SIWE result
        const mockSiweResult = {
            login: { wallet: "0x123" },
            siweAuthenticate: {
                signature: "0xdef",
                message: "Example message",
            },
        };

        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockSiweResult),
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // SIWE modal params
        const modalParams = {
            steps: {
                login: { allowSso: false },
                siweAuthenticate: {
                    siwe: {
                        domain: "example.com",
                        uri: "https://example.com/",
                        nonce: "123456",
                        version: "1",
                    },
                },
            },
        } as DisplayModalParamsType<ModalStepTypes[]>;

        // Execute
        const result = await displayModal(mockClient, modalParams);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_displayModal",
            params: [modalParams.steps, mockClientMetadataName, undefined],
        });
        expect(result).toEqual(mockSiweResult);
    });
});
