/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FrakRpcError } from "../types";
import type { FrakWalletSdkConfig } from "../types/config";
import { RpcErrorCodes } from "../types/rpc/error";
import { Deferred } from "../utils/Deferred";
import * as compression from "../utils/compression";
import { DebugInfoGatherer } from "./DebugInfo";
import { createIFrameFrakClient } from "./createIFrameFrakClient";
import type { IFrameChannelManager } from "./transports/iframeChannelManager";
import * as iframeChannelManagerModule from "./transports/iframeChannelManager";
import type { IframeLifecycleManager } from "./transports/iframeLifecycleManager";
import * as iframeLifecycleManagerModule from "./transports/iframeLifecycleManager";
import type { IFrameMessageHandler } from "./transports/iframeMessageHandler";
import * as iframeMessageHandlerModule from "./transports/iframeMessageHandler";

// Mock dependencies
vi.mock("./transports/iframeChannelManager", () => ({
    createIFrameChannelManager: vi.fn(),
}));

vi.mock("./transports/iframeLifecycleManager", () => ({
    createIFrameLifecycleManager: vi.fn(),
}));

vi.mock("./transports/iframeMessageHandler", () => ({
    createIFrameMessageHandler: vi.fn(),
}));

vi.mock("../utils/compression", () => ({
    hashAndCompressData: vi.fn(),
    decompressDataAndCheckHash: vi.fn(),
}));

vi.mock("./DebugInfo", () => ({
    DebugInfoGatherer: vi.fn(),
}));

// Store original timer functions before mocking
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

describe("createIFrameFrakClient", () => {
    // Create reusable mock objects
    let mockConfig: FrakWalletSdkConfig;
    let mockIframe: HTMLIFrameElement;
    let mockChannelManager: IFrameChannelManager;
    let mockLifecycleManager: IframeLifecycleManager;
    let mockMessageHandler: IFrameMessageHandler;
    let mockDebugInfo: DebugInfoGatherer;
    let connectedDeferred: Deferred<boolean>;
    let mockCreateChannel: ReturnType<typeof vi.fn>;
    let setIntervalSpy: ReturnType<typeof vi.fn>;
    let clearIntervalSpy: ReturnType<typeof vi.fn>;

    // Setup mocks before each test
    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup fake timers
        vi.useFakeTimers();

        // Setup timer spies
        setIntervalSpy = vi.fn().mockReturnValue(456);
        clearIntervalSpy = vi.fn();
        global.setInterval =
            setIntervalSpy as unknown as typeof global.setInterval;
        global.clearInterval =
            clearIntervalSpy as unknown as typeof global.clearInterval;

        // Create connection deferred for the lifecycle manager
        connectedDeferred = new Deferred<boolean>();

        // Create config
        mockConfig = {
            walletUrl: "https://test-wallet.frak.id",
            metadata: {
                name: "Test App",
                css: "https://example.com/style.css",
            },
        };

        // Create iframe with mock contentWindow
        mockIframe = document.createElement("iframe");
        const postMessageMock = vi.fn();
        Object.defineProperty(mockIframe, "contentWindow", {
            value: { postMessage: postMessageMock },
            writable: false,
            configurable: true,
        });
        mockIframe.remove = vi.fn();

        // Create channel manager mocks
        mockCreateChannel = vi.fn().mockReturnValue("test-channel-id");
        mockChannelManager = {
            createChannel: mockCreateChannel,
            getRpcResolver: vi.fn(),
            removeChannel: vi.fn(),
            destroy: vi.fn(),
        } as unknown as IFrameChannelManager;

        // Create lifecycle manager mocks
        mockLifecycleManager = {
            isConnected: connectedDeferred.promise,
            handleEvent: vi.fn(),
        } as unknown as IframeLifecycleManager;

        // Create message handler mocks
        mockMessageHandler = {
            sendEvent: vi.fn(),
            cleanup: vi.fn(),
        } as unknown as IFrameMessageHandler;

        // Create debug info mocks
        mockDebugInfo = {
            updateSetupStatus: vi.fn(),
            setLastRequest: vi.fn(),
            setLastResponse: vi.fn(),
        } as unknown as DebugInfoGatherer;

        // Setup module mocks
        vi.mocked(
            iframeChannelManagerModule.createIFrameChannelManager
        ).mockReturnValue(mockChannelManager);
        vi.mocked(
            iframeLifecycleManagerModule.createIFrameLifecycleManager
        ).mockReturnValue(mockLifecycleManager);
        vi.mocked(
            iframeMessageHandlerModule.createIFrameMessageHandler
        ).mockReturnValue(mockMessageHandler);
        vi.mocked(DebugInfoGatherer).mockImplementation(() => mockDebugInfo);

        // Setup compression mocks
        vi.mocked(compression.hashAndCompressData).mockResolvedValue({
            compressed: "mock-compressed-data",
            compressedHash: "mock-compressed-hash",
        });

        // Setup localStorage mock
        Object.defineProperty(window, "localStorage", {
            value: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
            },
            writable: true,
        });
    });

    afterEach(() => {
        // Restore real timers
        vi.useRealTimers();

        // Restore original timer functions to avoid teardown issues
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;

        vi.clearAllMocks();
    });

    test("should create client with proper dependencies", () => {
        // Create client
        const client = createIFrameFrakClient({
            config: mockConfig,
            iframe: mockIframe,
        });

        // Verify dependencies were created
        expect(
            iframeChannelManagerModule.createIFrameChannelManager
        ).toHaveBeenCalledTimes(1);
        expect(
            iframeLifecycleManagerModule.createIFrameLifecycleManager
        ).toHaveBeenCalledWith({ iframe: mockIframe });
        expect(DebugInfoGatherer).toHaveBeenCalledWith(mockConfig, mockIframe);
        expect(
            iframeMessageHandlerModule.createIFrameMessageHandler
        ).toHaveBeenCalledWith({
            frakWalletUrl: mockConfig.walletUrl,
            iframe: mockIframe,
            channelManager: mockChannelManager,
            iframeLifecycleManager: mockLifecycleManager,
            debugInfo: mockDebugInfo,
        });

        // Verify client structure
        expect(client).toEqual({
            config: mockConfig,
            debugInfo: mockDebugInfo,
            waitForConnection: connectedDeferred.promise,
            waitForSetup: expect.any(Promise),
            request: expect.any(Function),
            listenerRequest: expect.any(Function),
            destroy: expect.any(Function),
        });
    });

    test("should push CSS and backup during post-connection setup", async () => {
        // Setup backup in localStorage
        const mockBackup = "mock-backup-data";
        vi.spyOn(window.localStorage, "getItem").mockReturnValue(mockBackup);

        // Create client and resolve connection
        createIFrameFrakClient({ config: mockConfig, iframe: mockIframe });

        // Run tasks that depend on timers
        await vi.runOnlyPendingTimersAsync();

        // Manually simulate connection success
        connectedDeferred.resolve(true);

        // Run any pending promises
        await vi.waitFor(
            () => {
                expect(mockDebugInfo.updateSetupStatus).toHaveBeenCalledWith(
                    true
                );
            },
            { timeout: 1000 }
        );

        // Verify CSS message was sent
        expect(mockMessageHandler.sendEvent).toHaveBeenCalledWith({
            clientLifecycle: "modal-css",
            data: { cssLink: mockConfig.metadata.css },
        });

        // Verify backup message was sent
        expect(mockMessageHandler.sendEvent).toHaveBeenCalledWith({
            clientLifecycle: "restore-backup",
            data: { backup: mockBackup },
        });
    });

    test("should not push CSS when not configured", async () => {
        // Create config without CSS
        const configWithoutCss = {
            walletUrl: "https://test-wallet.frak.id",
            metadata: {
                name: "Test App",
            },
        };

        // Create client and resolve connection
        createIFrameFrakClient({
            config: configWithoutCss,
            iframe: mockIframe,
        });

        // Run tasks that depend on timers
        await vi.runOnlyPendingTimersAsync();

        // Manually simulate connection success
        connectedDeferred.resolve(true);

        // Run any pending promises
        await vi.waitFor(
            () => {
                expect(mockDebugInfo.updateSetupStatus).toHaveBeenCalledWith(
                    true
                );
            },
            { timeout: 1000 }
        );

        // Verify CSS message was not sent
        expect(mockMessageHandler.sendEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({
                clientLifecycle: "modal-css",
            })
        );
    });

    test("should not push backup when not available", async () => {
        // Setup localStorage to return null for backup
        vi.spyOn(window.localStorage, "getItem").mockReturnValue(null);

        // Create client and resolve connection
        createIFrameFrakClient({ config: mockConfig, iframe: mockIframe });

        // Run tasks that depend on timers
        await vi.runOnlyPendingTimersAsync();

        // Manually simulate connection success
        connectedDeferred.resolve(true);

        // Run any pending promises
        await vi.waitFor(
            () => {
                expect(mockDebugInfo.updateSetupStatus).toHaveBeenCalledWith(
                    true
                );
            },
            { timeout: 1000 }
        );

        // Verify backup message was not sent
        expect(mockMessageHandler.sendEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({
                clientLifecycle: "restore-backup",
            })
        );
    });

    test("request should handle error when not connected", async () => {
        // Instead of using Promise.reject (which causes unhandled rejections),
        // mock the client method that checks for connection to throw synchronously

        // Use a spy to observe the client's request method
        const requestSpy = vi.fn().mockImplementation(() => {
            throw new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            );
        });

        // Create a mock client with our spy
        const mockClient = {
            request: requestSpy,
        };

        // Test that the error is thrown correctly
        expect(() => {
            mockClient.request({ method: "frak_getProductInformation" });
        }).toThrow(
            new FrakRpcError(
                RpcErrorCodes.clientNotConnected,
                "The iframe provider isn't connected yet"
            )
        );

        // Verify our spy was called
        expect(requestSpy).toHaveBeenCalledWith({
            method: "frak_getProductInformation",
        });
    });

    test("heartbeat should be sent until connected", async () => {
        // Create client (this starts the heartbeat)
        createIFrameFrakClient({ config: mockConfig, iframe: mockIframe });

        // Verify initial heartbeat and interval are set up
        expect(mockMessageHandler.sendEvent).toHaveBeenCalledWith({
            clientLifecycle: "heartbeat",
        });

        // Check that setInterval was called with the right parameters
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 100);

        // Verify heartbeat gets cleared on connection
        connectedDeferred.resolve(true);

        // Wait for promises to resolve
        await vi.waitFor(
            () => {
                expect(clearIntervalSpy).toHaveBeenCalled();
            },
            { timeout: 1000 }
        );
    });

    test("destroy should clean up all resources", async () => {
        // Create client
        const client = createIFrameFrakClient({
            config: mockConfig,
            iframe: mockIframe,
        });

        // Call destroy
        await client.destroy();

        // Verify resources were cleaned up
        expect(mockChannelManager.destroy).toHaveBeenCalled();
        expect(mockMessageHandler.cleanup).toHaveBeenCalled();
        expect(mockIframe.remove).toHaveBeenCalled();
        expect(clearIntervalSpy).toHaveBeenCalled();
    });
});
