/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrakRpcError, type IFrameEvent, RpcErrorCodes } from "../types";
import { DebugInfoGatherer } from "./DebugInfo";

describe("DebugInfoGatherer", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        // Mock btoa globally
        vi.spyOn(global, "btoa").mockImplementation(
            (str) => `mocked-base64:${str}`
        );

        // Mock window location
        Object.defineProperty(window, "location", {
            value: { href: "https://test.example.com" },
            writable: true,
        });

        // Mock navigator
        Object.defineProperty(window, "navigator", {
            value: {
                userAgent: "test-agent",
                language: "en-US",
                onLine: true,
            },
            writable: true,
        });

        // Mock screen
        Object.defineProperty(window, "screen", {
            value: { width: 1920, height: 1080 },
            writable: true,
        });

        // Mock devicePixelRatio
        Object.defineProperty(window, "devicePixelRatio", {
            value: 2,
            writable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should initialize correctly without params", () => {
        const debugInfo = new DebugInfoGatherer();
        expect(debugInfo).toBeDefined();

        const formattedInfo = debugInfo.formatDebugInfo("test error");
        expect(formattedInfo).toContain("Error: test error");
        expect(formattedInfo).toContain("Config: no-config");
        expect(formattedInfo).toContain("Client Status: not-setup");
    });

    it("should initialize correctly with config", () => {
        const mockConfig = {
            apiKey: "test-key",
            metadata: { name: "Test App" },
        };
        const debugInfo = new DebugInfoGatherer(mockConfig);

        const formattedInfo = debugInfo.formatDebugInfo("test error");
        expect(formattedInfo).toContain("Config: mocked-base64:");
        expect(formattedInfo).toContain("Client Status: not-setup");
    });

    it("should track last request and response", () => {
        const debugInfo = new DebugInfoGatherer();

        // Test initial state
        const initialInfo = debugInfo.formatDebugInfo("test");
        expect(initialInfo).toContain("Last Request: No Frak request logged");
        expect(initialInfo).toContain("Last Response: No Frak response logged");

        // Set request and response
        const mockRequest = {
            method: "test_method",
            params: { test: true },
        } as unknown as IFrameEvent;
        debugInfo.setLastRequest(mockRequest, "test-target");

        const mockResponseEvent = {
            data: { result: { success: true } },
            origin: "https://test.origin.com",
        } as unknown as MessageEvent<IFrameEvent>;
        debugInfo.setLastResponse(mockResponseEvent);

        // Verify updated state
        const updatedInfo = debugInfo.formatDebugInfo("test");
        expect(updatedInfo).toContain("Last Request: mocked-base64:");
        expect(updatedInfo).toContain("Last Response: mocked-base64:");
    });

    it("should update setup status", () => {
        const debugInfo = new DebugInfoGatherer();

        // Test initial state
        let info = debugInfo.formatDebugInfo("test");
        expect(info).toContain("Client Status: not-setup");

        // Update status
        debugInfo.updateSetupStatus(true);

        // Test updated state
        info = debugInfo.formatDebugInfo("test");
        expect(info).toContain("Client Status: setup");
    });

    it("should format different error types correctly", () => {
        const debugInfo = new DebugInfoGatherer();

        // Test string error
        let info = debugInfo.formatDebugInfo("string error");
        expect(info).toContain("Error: string error");

        // Test Error object
        info = debugInfo.formatDebugInfo(new Error("standard error"));
        expect(info).toContain("Error: standard error");

        // Test FrakRpcError
        const rpcError = new FrakRpcError(
            RpcErrorCodes.walletNotConnected,
            "wallet error"
        );
        info = debugInfo.formatDebugInfo(rpcError);
        expect(info).toContain(
            `FrakRpcError: ${RpcErrorCodes.walletNotConnected} 'wallet error'`
        );

        // Test unknown error
        info = debugInfo.formatDebugInfo(null);
        expect(info).toContain("Error: Unknown");
    });

    it("should handle iframe information", () => {
        // Create mock iframe
        const mockIframe = document.createElement("iframe");
        mockIframe.src = "https://test-iframe.com";
        document.body.appendChild(mockIframe);

        const debugInfo = new DebugInfoGatherer(undefined, mockIframe);
        const info = debugInfo.formatDebugInfo("test");

        expect(info).toContain("IFrame Status: mocked-base64:");

        // Cleanup
        document.body.removeChild(mockIframe);
    });

    it("should create empty gatherer with static method", () => {
        const debugInfo = DebugInfoGatherer.empty();
        expect(debugInfo).toBeInstanceOf(DebugInfoGatherer);

        const info = debugInfo.formatDebugInfo("test");
        expect(info).toContain("Config: no-config");
    });

    it("should handle encoding failures gracefully", () => {
        const debugInfo = new DebugInfoGatherer();

        // Spy on console.warn to verify it's called
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        // Mock JSON.stringify to throw
        const stringifySpy = vi
            .spyOn(JSON, "stringify")
            .mockImplementation(() => {
                throw new Error("Circular");
            });

        const info = debugInfo.formatDebugInfo("test error");

        // Verify warn was called
        expect(consoleWarnSpy).toHaveBeenCalled();
        // Since we already mocked btoa above, the message should contain our mocked prefix
        expect(info).toContain("mocked-base64:Failed to encode data");

        // Clean up
        stringifySpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });
});
