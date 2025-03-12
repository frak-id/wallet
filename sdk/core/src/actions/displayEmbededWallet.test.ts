/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { DisplayEmbededWalletParamsType, FrakClient } from "../types";
import { displayEmbededWallet } from "./displayEmbededWallet";

describe("displayEmbededWallet", () => {
    // Mock client metadata
    const mockClientMetadataName = "My App";

    it("should call client request with correct parameters", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(undefined),
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // Basic params
        const params: DisplayEmbededWalletParamsType = {
            metadata: {
                lang: "fr",
            },
        };

        // Execute
        await displayEmbededWallet(mockClient, params);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_displayEmbededWallet",
            params: [params, mockClientMetadataName],
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

        // Basic params
        const params: DisplayEmbededWalletParamsType = {
            metadata: {
                lang: "fr",
            },
        };

        // Execute and verify error is thrown
        await expect(displayEmbededWallet(mockClient, params)).rejects.toThrow(
            mockError
        );
    });

    it("should pass optional parameters correctly", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(undefined),
            config: {
                metadata: {
                    name: mockClientMetadataName,
                },
            },
        } as unknown as FrakClient;

        // Params with optional properties
        const params: DisplayEmbededWalletParamsType = {
            metadata: {
                lang: "fr",
            },
        };

        // Execute
        await displayEmbededWallet(mockClient, params);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_displayEmbededWallet",
            params: [params, mockClientMetadataName],
        });
    });
});
