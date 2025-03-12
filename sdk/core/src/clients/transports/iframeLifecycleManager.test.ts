/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IFrameLifecycleEvent } from "../../types/lifecycle/iframe";
import { BACKUP_KEY } from "../../utils/constants";
import * as iframeHelper from "../../utils/iframeHelper";
import { createIFrameLifecycleManager } from "./iframeLifecycleManager";

// Mock the iframeHelper to avoid actual DOM manipulation
vi.mock("../../utils/iframeHelper", () => ({
    changeIframeVisibility: vi.fn(),
}));

describe("iframeLifecycleManager", () => {
    let mockIframe: HTMLIFrameElement;
    let mockContentWindow: { postMessage: ReturnType<typeof vi.fn> };
    let lifecycleManager: ReturnType<typeof createIFrameLifecycleManager>;

    // Setup spies and mocks
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    const localStorageRemoveSpy = vi.spyOn(Storage.prototype, "removeItem");

    beforeEach(() => {
        // Create a mock iframe
        mockIframe = document.createElement("iframe");

        // Create a mock content window with a spied postMessage method
        mockContentWindow = { postMessage: vi.fn() };
        Object.defineProperty(mockIframe, "contentWindow", {
            value: mockContentWindow,
            writable: true,
        });

        // Create a lifecycle manager with the mock iframe
        lifecycleManager = createIFrameLifecycleManager({ iframe: mockIframe });

        // Reset all mocks and spies
        vi.clearAllMocks();
    });

    test("should initialize with a pending connected state", () => {
        // The isConnected promise should be pending initially
        expect(lifecycleManager.isConnected).toBeInstanceOf(Promise);
    });

    test("should resolve connected state when 'connected' event is received", async () => {
        // Create a connected event
        const connectedEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "connected",
        };

        // Handle the event
        await lifecycleManager.handleEvent(connectedEvent);

        // The isConnected promise should now resolve to true
        expect(await lifecycleManager.isConnected).toBe(true);
    });

    test("should handle 'do-backup' event by storing backup in localStorage", async () => {
        // Create a do-backup event with backup data
        const backupEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "do-backup",
            data: { backup: "test-backup-data" },
        };

        // Handle the event
        await lifecycleManager.handleEvent(backupEvent);

        // Verify localStorage.setItem was called with the correct arguments
        expect(localStorageSpy).toHaveBeenCalledWith(
            BACKUP_KEY,
            "test-backup-data"
        );
    });

    test("should handle 'do-backup' event with empty backup by removing from localStorage", async () => {
        // Create a do-backup event with empty backup
        const backupEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "do-backup",
            data: { backup: undefined },
        };

        // Handle the event
        await lifecycleManager.handleEvent(backupEvent);

        // Verify localStorage.removeItem was called with the correct key
        expect(localStorageRemoveSpy).toHaveBeenCalledWith(BACKUP_KEY);
    });

    test("should handle 'remove-backup' event by removing backup from localStorage", async () => {
        // Create a remove-backup event
        const removeBackupEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "remove-backup",
        };

        // Handle the event
        await lifecycleManager.handleEvent(removeBackupEvent);

        // Verify localStorage.removeItem was called with the correct key
        expect(localStorageRemoveSpy).toHaveBeenCalledWith(BACKUP_KEY);
    });

    test("should handle 'show' event by calling changeIframeVisibility with visible=true", async () => {
        // Create a show event
        const showEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "show",
        };

        // Handle the event
        await lifecycleManager.handleEvent(showEvent);

        // Verify changeIframeVisibility was called correctly
        expect(iframeHelper.changeIframeVisibility).toHaveBeenCalledWith({
            iframe: mockIframe,
            isVisible: true,
        });
    });

    test("should handle 'hide' event by calling changeIframeVisibility with visible=false", async () => {
        // Create a hide event
        const hideEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "hide",
        };

        // Handle the event
        await lifecycleManager.handleEvent(hideEvent);

        // Verify changeIframeVisibility was called correctly
        expect(iframeHelper.changeIframeVisibility).toHaveBeenCalledWith({
            iframe: mockIframe,
            isVisible: false,
        });
    });

    test("should handle 'handshake' event by sending a handshake-response message", async () => {
        // Save the original window.location.href
        const originalHref = window.location.href;

        // Mock window.location.href
        Object.defineProperty(window, "location", {
            value: { href: "https://example.com/test" },
            writable: true,
        });

        // Create a handshake event
        const handshakeEvent: IFrameLifecycleEvent = {
            iframeLifecycle: "handshake",
            data: { token: "test-token" },
        };

        // Handle the event
        await lifecycleManager.handleEvent(handshakeEvent);

        // Verify postMessage was called with the correct arguments
        expect(mockContentWindow.postMessage).toHaveBeenCalledWith(
            {
                clientLifecycle: "handshake-response",
                data: {
                    token: "test-token",
                    currentUrl: "https://example.com/test",
                },
            },
            "*"
        );

        // Restore window.location.href
        Object.defineProperty(window, "location", {
            value: { href: originalHref },
            writable: true,
        });
    });
});
