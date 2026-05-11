import type { RpcClient } from "@frak-labs/frame-connector";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import type { FrakLifecycleEvent } from "../types";
import type { IFrameRpcSchema } from "../types/rpc";
import { setupSsoUrlListener } from "./ssoUrlListener";

describe("setupSsoUrlListener", () => {
    let mockRpcClient: RpcClient<IFrameRpcSchema, FrakLifecycleEvent>;
    let mockWaitForConnection: Promise<boolean>;
    let originalLocation: Location;
    let originalHistory: History;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Save original values
        originalLocation = window.location;
        originalHistory = window.history;

        // Mock RPC client
        mockRpcClient = {
            sendLifecycle: vi.fn(),
        } as any;

        // Mock console methods
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        // Mock history.replaceState
        window.history.replaceState = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();

        // Restore original values
        Object.defineProperty(window, "location", {
            value: originalLocation,
            writable: true,
        });
        Object.defineProperty(window, "history", {
            value: originalHistory,
            writable: true,
        });
    });

    it("should do nothing when window is undefined", () => {
        const originalWindow = global.window;
        // @ts-expect-error - intentionally removing window for test
        delete global.window;

        setupSsoUrlListener(mockRpcClient, Promise.resolve(true));

        expect(mockRpcClient.sendLifecycle).not.toHaveBeenCalled();

        // Restore window
        global.window = originalWindow;
    });

    it("should do nothing when no SSO parameter in URL", () => {
        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/test",
            },
            writable: true,
        });

        setupSsoUrlListener(mockRpcClient, Promise.resolve(true));

        expect(mockRpcClient.sendLifecycle).not.toHaveBeenCalled();
        expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it("should forward SSO data to iframe when connection is ready", async () => {
        const compressedSso = "compressed-sso-data";
        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?sso=${compressedSso}`,
            },
            writable: true,
        });

        mockWaitForConnection = Promise.resolve(true);

        setupSsoUrlListener(mockRpcClient, mockWaitForConnection);

        await mockWaitForConnection;

        // Wait for promise to resolve
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockRpcClient.sendLifecycle).toHaveBeenCalledWith({
            clientLifecycle: "sso-redirect-complete",
            data: { compressed: compressedSso },
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[SSO URL Listener] Forwarded compressed SSO data to iframe"
        );
    });

    it("should clean URL immediately after detecting SSO parameter", async () => {
        const compressedSso = "compressed-sso-data";
        const originalUrl = `https://example.com/test?sso=${compressedSso}`;
        Object.defineProperty(window, "location", {
            value: {
                href: originalUrl,
            },
            writable: true,
        });

        mockWaitForConnection = Promise.resolve(true);

        setupSsoUrlListener(mockRpcClient, mockWaitForConnection);

        // URL should be cleaned immediately, before connection resolves
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/test"
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[SSO URL Listener] SSO parameter detected and URL cleaned"
        );
    });

    it("should handle connection promise rejection", async () => {
        const compressedSso = "compressed-sso-data";
        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?sso=${compressedSso}`,
            },
            writable: true,
        });

        const connectionError = new Error("Connection failed");
        mockWaitForConnection = Promise.reject(connectionError);

        setupSsoUrlListener(mockRpcClient, mockWaitForConnection);

        await mockWaitForConnection.catch(() => {});

        // Wait for promise to reject
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockRpcClient.sendLifecycle).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "[SSO URL Listener] Failed to forward SSO data:",
            connectionError
        );
    });

    it("should handle URL with multiple parameters", async () => {
        const compressedSso = "compressed-sso-data";
        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?param1=value1&sso=${compressedSso}&param2=value2`,
            },
            writable: true,
        });

        mockWaitForConnection = Promise.resolve(true);

        setupSsoUrlListener(mockRpcClient, mockWaitForConnection);

        await mockWaitForConnection;
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockRpcClient.sendLifecycle).toHaveBeenCalledWith({
            clientLifecycle: "sso-redirect-complete",
            data: { compressed: compressedSso },
        });

        // Should remove only the sso parameter
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/test?param1=value1&param2=value2"
        );
    });

    it("should not process empty SSO parameter", () => {
        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/test?sso=",
            },
            writable: true,
        });

        setupSsoUrlListener(mockRpcClient, Promise.resolve(true));

        // Empty string is falsy, so it should not process
        expect(window.history.replaceState).not.toHaveBeenCalled();
        expect(mockRpcClient.sendLifecycle).not.toHaveBeenCalled();
    });

    it("should clean URL even if connection fails", async () => {
        const compressedSso = "compressed-sso-data";
        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?sso=${compressedSso}`,
            },
            writable: true,
        });

        const connectionError = new Error("Connection failed");
        mockWaitForConnection = Promise.reject(connectionError);

        setupSsoUrlListener(mockRpcClient, mockWaitForConnection);

        // URL should still be cleaned even if connection fails
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/test"
        );

        await mockWaitForConnection.catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it("should handle URL with hash", () => {
        const compressedSso = "compressed-sso-data";
        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?sso=${compressedSso}#section`,
            },
            writable: true,
        });

        setupSsoUrlListener(mockRpcClient, Promise.resolve(true));

        // Should preserve hash when cleaning URL
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/test#section"
        );
    });
});
