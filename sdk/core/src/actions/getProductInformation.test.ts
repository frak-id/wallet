/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { FrakClient, GetProductInformationReturnType } from "../types";
import { getProductInformation } from "./getProductInformation";

describe("getProductInformation", () => {
    // Mock product information
    const mockProductInfo: GetProductInformationReturnType = {
        id: "0x123",
        onChainMetadata: {
            name: "Test Product",
            domain: "test.com",
            productTypes: ["webshop"],
        },
        estimatedEurReward: "100",
        rewards: [],
    };

    it("should call client request with correct method", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockProductInfo),
        } as unknown as FrakClient;

        // Execute
        const result = await getProductInformation(mockClient);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_getProductInformation",
        });
        expect(result).toEqual(mockProductInfo);
    });

    it("should forward client errors", async () => {
        // Mock error
        const mockError = new Error("RPC error");

        // Mock client with error
        const mockClient: FrakClient = {
            request: vi.fn().mockRejectedValue(mockError),
        } as unknown as FrakClient;

        // Execute and verify error is thrown
        await expect(getProductInformation(mockClient)).rejects.toThrow(
            mockError
        );
    });

    it("should handle empty response", async () => {
        // Mock client with empty response
        const emptyResponse = {};
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(emptyResponse),
        } as unknown as FrakClient;

        // Execute
        const result = await getProductInformation(mockClient);

        // Verify
        expect(result).toEqual(emptyResponse);
    });
});
