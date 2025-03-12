/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FrakRpcError } from "../../types";
import type { IFrameLifecycleEvent } from "../../types/lifecycle/iframe";
import { RpcErrorCodes } from "../../types/rpc/error";
import type { IFrameEvent, IFrameRpcEvent } from "../../types/transport";
import type { DebugInfoGatherer } from "../DebugInfo";
import type { IFrameChannelManager } from "./iframeChannelManager";
import type { IframeLifecycleManager } from "./iframeLifecycleManager";
import { createIFrameMessageHandler } from "./iframeMessageHandler";

// Create mock types for dependencies
type MockChannelManager = {
    getRpcResolver: ReturnType<typeof vi.fn>;
};

type MockLifecycleManager = {
    handleEvent: ReturnType<typeof vi.fn>;
};

type MockDebugInfo = {
    setLastResponse: ReturnType<typeof vi.fn>;
    setLastRequest: ReturnType<typeof vi.fn>;
};

describe("iframeMessageHandler", () => {
    // Mock dependencies
    let mockIframe: HTMLIFrameElement;
    let mockContentWindow: { postMessage: ReturnType<typeof vi.fn> };
    let mockChannelManager: MockChannelManager;
    let mockLifecycleManager: MockLifecycleManager;
    let mockDebugInfo: MockDebugInfo;
    let mockResolver: ReturnType<typeof vi.fn>;
    let messageHandler: ReturnType<typeof createIFrameMessageHandler>;

    // Setup the test environment
    beforeEach(() => {
        // Create a mock iframe
        mockIframe = document.createElement("iframe");

        // Create mock content window
        mockContentWindow = { postMessage: vi.fn() };
        Object.defineProperty(mockIframe, "contentWindow", {
            value: mockContentWindow,
            writable: true,
        });

        // Create mock dependencies
        mockResolver = vi.fn();
        mockChannelManager = {
            getRpcResolver: vi.fn().mockReturnValue(mockResolver),
        };

        mockLifecycleManager = {
            handleEvent: vi.fn().mockResolvedValue(undefined),
        };

        mockDebugInfo = {
            setLastResponse: vi.fn(),
            setLastRequest: vi.fn(),
        };

        // Create the message handler
        messageHandler = createIFrameMessageHandler({
            frakWalletUrl: "https://wallet.frak.id",
            iframe: mockIframe,
            channelManager:
                mockChannelManager as unknown as IFrameChannelManager,
            iframeLifecycleManager:
                mockLifecycleManager as unknown as IframeLifecycleManager,
            debugInfo: mockDebugInfo as unknown as DebugInfoGatherer,
        });

        // Reset all mocks
        vi.clearAllMocks();
    });

    test("should throw error when window is undefined", () => {
        // Save the original window
        const originalWindow = global.window;

        // Mock window to be undefined
        Object.defineProperty(global, "window", {
            value: undefined,
            writable: true,
        });

        // Creating a message handler should throw an error
        expect(() =>
            createIFrameMessageHandler({
                frakWalletUrl: "https://wallet.frak.id",
                iframe: mockIframe,
                channelManager:
                    mockChannelManager as unknown as IFrameChannelManager,
                iframeLifecycleManager:
                    mockLifecycleManager as unknown as IframeLifecycleManager,
                debugInfo: mockDebugInfo as unknown as DebugInfoGatherer,
            })
        ).toThrow(
            new FrakRpcError(
                RpcErrorCodes.configError,
                "iframe client should be used in the browser"
            )
        );

        // Restore the original window
        Object.defineProperty(global, "window", {
            value: originalWindow,
            writable: true,
        });
    });

    test("should throw error when iframe has no content window", () => {
        // Create a mock iframe without content window
        const emptyIframe = document.createElement("iframe");
        Object.defineProperty(emptyIframe, "contentWindow", {
            value: null,
            writable: true,
        });

        // Creating a message handler should throw an error
        expect(() =>
            createIFrameMessageHandler({
                frakWalletUrl: "https://wallet.frak.id",
                iframe: emptyIframe,
                channelManager:
                    mockChannelManager as unknown as IFrameChannelManager,
                iframeLifecycleManager:
                    mockLifecycleManager as unknown as IframeLifecycleManager,
                debugInfo: mockDebugInfo as unknown as DebugInfoGatherer,
            })
        ).toThrow(
            new FrakRpcError(
                RpcErrorCodes.configError,
                "The iframe does not have a product window"
            )
        );
    });

    test("should send events to the iframe", () => {
        // Create an event to send
        const mockEvent: IFrameEvent = {
            id: "test-channel",
            topic: "frak_getProductInformation",
            data: {
                compressed: "test-data",
                compressedHash: "test-hash",
            },
        };

        // Send the event
        messageHandler.sendEvent(mockEvent);

        // Verify postMessage was called correctly
        expect(mockContentWindow.postMessage).toHaveBeenCalledWith(mockEvent, {
            targetOrigin: "https://wallet.frak.id",
        });

        // Verify debug info was updated
        expect(mockDebugInfo.setLastRequest).toHaveBeenCalledWith(
            mockEvent,
            "https://wallet.frak.id"
        );
    });

    test("should handle iframe lifecycle events", () => {
        // Mock the message event
        const lifecycleEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "connected",
        };

        // Create a MessageEvent
        const messageEvent = new MessageEvent("message", {
            data: lifecycleEvent,
            origin: "https://wallet.frak.id",
        });

        // Dispatch the message event
        window.dispatchEvent(messageEvent);

        // Verify the lifecycle manager was called with the lifecycle event
        expect(mockLifecycleManager.handleEvent).toHaveBeenCalledWith(
            lifecycleEvent
        );

        // Verify debug info was updated
        expect(mockDebugInfo.setLastResponse).toHaveBeenCalledWith(
            messageEvent
        );
    });

    test("should handle iframe RPC events", () => {
        // Create a mock channel ID
        const mockChannelId = "test-channel";

        // Create a mock RPC event
        const rpcEvent: IFrameRpcEvent = {
            id: mockChannelId,
            topic: "frak_getProductInformation",
            data: {
                compressed: "test-data",
                compressedHash: "test-hash",
            },
        };

        // Create a MessageEvent
        const messageEvent = new MessageEvent("message", {
            data: rpcEvent,
            origin: "https://wallet.frak.id",
        });

        // Dispatch the message event
        window.dispatchEvent(messageEvent);

        // Verify the channel manager was queried for the resolver
        expect(mockChannelManager.getRpcResolver).toHaveBeenCalledWith(
            mockChannelId
        );

        // Verify the resolver was called with the RPC event
        expect(mockResolver).toHaveBeenCalledWith(rpcEvent);

        // Verify debug info was updated
        expect(mockDebugInfo.setLastResponse).toHaveBeenCalledWith(
            messageEvent
        );
    });

    test("should ignore events from unknown origins", () => {
        // Create a MessageEvent from an unknown origin
        const messageEvent = new MessageEvent("message", {
            data: { id: "test-channel" },
            origin: "https://unknown-origin.com",
        });

        // Dispatch the message event
        window.dispatchEvent(messageEvent);

        // Verify nothing was called
        expect(mockLifecycleManager.handleEvent).not.toHaveBeenCalled();
        expect(mockChannelManager.getRpcResolver).not.toHaveBeenCalled();
        expect(mockDebugInfo.setLastResponse).not.toHaveBeenCalled();
    });

    test("should ignore events with non-object data", () => {
        // Create a MessageEvent with non-object data
        const messageEvent = new MessageEvent("message", {
            data: "not-an-object",
            origin: "https://wallet.frak.id",
        });

        // Dispatch the message event
        window.dispatchEvent(messageEvent);

        // Verify nothing was called
        expect(mockLifecycleManager.handleEvent).not.toHaveBeenCalled();
        expect(mockChannelManager.getRpcResolver).not.toHaveBeenCalled();
        expect(mockDebugInfo.setLastResponse).not.toHaveBeenCalled();
    });

    test("should ignore events for unknown channels", () => {
        // Configure channel manager to return undefined (unknown channel)
        mockChannelManager.getRpcResolver.mockReturnValueOnce(undefined);

        // Create a mock RPC event
        const rpcEvent: IFrameRpcEvent = {
            id: "unknown-channel",
            topic: "frak_getProductInformation",
            data: {
                compressed: "test-data",
                compressedHash: "test-hash",
            },
        };

        // Create a MessageEvent
        const messageEvent = new MessageEvent("message", {
            data: rpcEvent,
            origin: "https://wallet.frak.id",
        });

        // Dispatch the message event
        window.dispatchEvent(messageEvent);

        // Verify the channel manager was queried for the resolver
        expect(mockChannelManager.getRpcResolver).toHaveBeenCalledWith(
            "unknown-channel"
        );

        // Verify the resolver was not called
        expect(mockResolver).not.toHaveBeenCalled();

        // Verify debug info was still updated
        expect(mockDebugInfo.setLastResponse).toHaveBeenCalledWith(
            messageEvent
        );
    });

    test("should remove event listener when cleanup is called", () => {
        // Spy on window.removeEventListener
        const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

        // Call cleanup
        messageHandler.cleanup();

        // Verify removeEventListener was called
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
            "message",
            expect.any(Function)
        );
    });
});
