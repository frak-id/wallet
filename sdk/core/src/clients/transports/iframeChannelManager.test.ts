import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IFrameRpcEvent } from "../../types/transport";
import {
    type IFrameChannelManager,
    createIFrameChannelManager,
} from "./iframeChannelManager";

describe("iframeChannelManager", () => {
    let channelManager: IFrameChannelManager;
    let mockResolver: (message: IFrameRpcEvent) => Promise<void>;

    beforeEach(() => {
        // Create a new channel manager for each test
        channelManager = createIFrameChannelManager();
        // Create a mock resolver function
        mockResolver = vi.fn().mockResolvedValue(undefined);
    });

    test("should create a channel with a unique ID", () => {
        const channelId = channelManager.createChannel(mockResolver);

        // Channel ID should be a non-empty string
        expect(typeof channelId).toBe("string");
        expect(channelId.length).toBeGreaterThan(0);
    });

    test("should create channels with unique IDs", () => {
        const channelId1 = channelManager.createChannel(mockResolver);
        const channelId2 = channelManager.createChannel(mockResolver);

        // IDs should be different
        expect(channelId1).not.toBe(channelId2);
    });

    test("should retrieve the correct resolver for a channel", async () => {
        const channelId = channelManager.createChannel(mockResolver);
        const resolver = channelManager.getRpcResolver(channelId);

        // Resolver should be the same one we provided
        expect(resolver).toBe(mockResolver);

        // Test that the resolver works correctly
        const mockMessage: IFrameRpcEvent = {
            id: channelId,
            topic: "frak_getProductInformation", // Using a valid topic
            data: {
                compressed: "test-data",
                compressedHash: "test-hash",
            },
        };

        if (resolver) {
            await resolver(mockMessage);
            expect(mockResolver).toHaveBeenCalledWith(mockMessage);
        } else {
            throw new Error("Resolver should be defined");
        }
    });

    test("should return undefined for non-existent channel", () => {
        const resolver = channelManager.getRpcResolver("non-existent-channel");
        expect(resolver).toBeUndefined();
    });

    test("should successfully remove a channel", () => {
        // Create a channel
        const channelId = channelManager.createChannel(mockResolver);

        // Verify it exists
        const resolver = channelManager.getRpcResolver(channelId);
        expect(resolver).toBeDefined();

        // Remove the channel
        channelManager.removeChannel(channelId);

        // Verify it no longer exists
        const resolverAfterRemoval = channelManager.getRpcResolver(channelId);
        expect(resolverAfterRemoval).toBeUndefined();
    });

    test("should gracefully handle removing a non-existent channel", () => {
        // This should not throw an error
        expect(() =>
            channelManager.removeChannel("non-existent-channel")
        ).not.toThrow();
    });

    test("should clear all channels when destroy is called", () => {
        // Create multiple channels
        const channelId1 = channelManager.createChannel(mockResolver);
        const channelId2 = channelManager.createChannel(mockResolver);
        const channelId3 = channelManager.createChannel(mockResolver);

        // Verify they exist
        expect(channelManager.getRpcResolver(channelId1)).toBeDefined();
        expect(channelManager.getRpcResolver(channelId2)).toBeDefined();
        expect(channelManager.getRpcResolver(channelId3)).toBeDefined();

        // Destroy the channel manager
        channelManager.destroy();

        // Verify all channels are gone
        expect(channelManager.getRpcResolver(channelId1)).toBeUndefined();
        expect(channelManager.getRpcResolver(channelId2)).toBeUndefined();
        expect(channelManager.getRpcResolver(channelId3)).toBeUndefined();
    });
});
