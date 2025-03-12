/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { FrakClient, PreparedInteraction } from "../types";
import { computeProductId } from "../utils/computeProductId";
import { sendInteraction } from "./sendInteraction";

// Mock computeProductId utility
vi.mock("../utils/computeProductId", () => ({
    computeProductId: vi.fn(),
}));

describe("sendInteraction", () => {
    // Test data
    const mockProductId = "0x123";
    const mockInteraction = "0xabc";
    const mockValidation = { signature: "0xdef" };
    const mockDelegationId = "delegation123";

    // Mock return value
    const mockReturnValue = {
        delegationId: mockDelegationId,
    };

    it("should use provided productId when available", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockReturnValue),
            config: {},
        } as unknown as FrakClient;

        // Execute
        const result = await sendInteraction(mockClient, {
            productId: mockProductId,
            interaction: mockInteraction as unknown as PreparedInteraction,
        });

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_sendInteraction",
            params: [mockProductId, mockInteraction, undefined],
        });
        expect(computeProductId).not.toHaveBeenCalled();
        expect(result).toEqual(mockReturnValue);
    });

    it("should compute productId when not provided", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockReturnValue),
            config: { domain: "example.com" },
        } as unknown as FrakClient;

        // Mock computeProductId to return a value
        vi.mocked(computeProductId).mockReturnValue(mockProductId);

        // Execute
        const result = await sendInteraction(mockClient, {
            interaction: mockInteraction as unknown as PreparedInteraction,
        });

        // Verify
        expect(computeProductId).toHaveBeenCalledWith(mockClient.config);
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_sendInteraction",
            params: [mockProductId, mockInteraction, undefined],
        });
        expect(result).toEqual(mockReturnValue);
    });

    it("should include validation when provided", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(mockReturnValue),
            config: {},
        } as unknown as FrakClient;

        // Mock computeProductId to return a value
        vi.mocked(computeProductId).mockReturnValue(mockProductId);

        // Execute
        const result = await sendInteraction(mockClient, {
            interaction: mockInteraction as unknown as PreparedInteraction,
            validation: mockValidation as unknown as `0x${string}`,
        });

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_sendInteraction",
            params: [mockProductId, mockInteraction, mockValidation],
        });
        expect(result).toEqual(mockReturnValue);
    });

    it("should forward client errors", async () => {
        // Mock error
        const mockError = new Error("RPC error");

        // Mock client with error
        const mockClient: FrakClient = {
            request: vi.fn().mockRejectedValue(mockError),
            config: {},
        } as unknown as FrakClient;

        // Mock computeProductId to return a value
        vi.mocked(computeProductId).mockReturnValue(mockProductId);

        // Execute and verify error is thrown
        await expect(
            sendInteraction(mockClient, {
                interaction: mockInteraction as unknown as PreparedInteraction,
            })
        ).rejects.toThrow(mockError);
    });
});
