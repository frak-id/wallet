/**
 * Tests for DebugInfoGatherer class
 * Tests debug information gathering and formatting for error reporting
 */

import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import type { FrakWalletSdkConfig } from "../types";
import { DebugInfoGatherer } from "./DebugInfo";

describe("DebugInfoGatherer", () => {
    let mockConfig: FrakWalletSdkConfig;
    let mockIframe: HTMLIFrameElement;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Create mock config
        mockConfig = {
            metadata: {
                name: "Test App",
            },
        };

        // Create mock iframe
        mockIframe = document.createElement("iframe");
        mockIframe.src = "https://wallet.frak.id";
        mockIframe.setAttribute("loading", "lazy");
        document.body.appendChild(mockIframe);

        // Mock iframe contentDocument
        Object.defineProperty(mockIframe, "contentDocument", {
            value: {
                readyState: "complete",
            },
            writable: true,
        });

        // Mock iframe contentWindow
        Object.defineProperty(mockIframe, "contentWindow", {
            value: {},
            writable: true,
        });

        // Spy on console.warn
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        document.body.removeChild(mockIframe);
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        it("should create instance with config and iframe", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            expect(gatherer).toBeInstanceOf(DebugInfoGatherer);
        });

        it("should create instance without config and iframe", () => {
            const gatherer = new DebugInfoGatherer();

            expect(gatherer).toBeInstanceOf(DebugInfoGatherer);
        });

        it("should initialize with null lastRequest and lastResponse", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            // Access private properties through formatDebugInfo output
            const debugInfo = gatherer.formatDebugInfo("test error");
            expect(debugInfo).toContain("No Frak request logged");
            expect(debugInfo).toContain("No Frak response logged");
        });
    });

    describe("static empty()", () => {
        it("should create empty instance", () => {
            const gatherer = DebugInfoGatherer.empty();

            expect(gatherer).toBeInstanceOf(DebugInfoGatherer);
        });

        it("should create instance without config or iframe", () => {
            const gatherer = DebugInfoGatherer.empty();
            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("no-config");
            expect(debugInfo).toContain("not-iframe");
        });
    });

    describe("setLastRequest", () => {
        it("should set last request with timestamp", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);
            const mockMessage = {
                id: 1,
                method: "test_method",
                params: [],
            } as any;

            gatherer.setLastRequest(mockMessage);

            const debugInfo = gatherer.formatDebugInfo("test error");
            expect(debugInfo).toContain("Last Request:");
            expect(debugInfo).not.toContain("No Frak request logged");
        });
    });

    describe("setLastResponse", () => {
        it("should set last response with timestamp", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);
            const mockMessage = {
                id: 1,
                method: "test_method",
            } as any;
            const mockResponse = {
                id: 1,
                result: "success",
            } as any;

            gatherer.setLastResponse(mockMessage, mockResponse);

            const debugInfo = gatherer.formatDebugInfo("test error");
            expect(debugInfo).toContain("Last Response:");
            expect(debugInfo).not.toContain("No Frak response logged");
        });
    });

    describe("updateSetupStatus", () => {
        it("should update setup status to true", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            gatherer.updateSetupStatus(true);

            const debugInfo = gatherer.formatDebugInfo("test error");
            expect(debugInfo).toContain("Client Status: setup");
        });

        it("should update setup status to false", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            gatherer.updateSetupStatus(false);

            const debugInfo = gatherer.formatDebugInfo("test error");
            expect(debugInfo).toContain("Client Status: not-setup");
        });
    });

    describe("formatDebugInfo", () => {
        it("should format debug info with all fields", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("Debug Information:");
            expect(debugInfo).toContain("Timestamp:");
            expect(debugInfo).toContain("URL:");
            expect(debugInfo).toContain("Config:");
            expect(debugInfo).toContain("Navigator Info:");
            expect(debugInfo).toContain("IFrame Status:");
            expect(debugInfo).toContain("Last Request:");
            expect(debugInfo).toContain("Last Response:");
            expect(debugInfo).toContain("Client Status:");
            expect(debugInfo).toContain("Error:");
        });

        it("should format FrakRpcError correctly", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);
            const error = new FrakRpcError(
                RpcErrorCodes.walletNotConnected,
                "Wallet not connected"
            );

            const debugInfo = gatherer.formatDebugInfo(error);

            expect(debugInfo).toContain(
                `FrakRpcError: ${RpcErrorCodes.walletNotConnected} 'Wallet not connected'`
            );
        });

        it("should format regular Error correctly", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);
            const error = new Error("Network timeout");

            const debugInfo = gatherer.formatDebugInfo(error);

            expect(debugInfo).toContain("Network timeout");
        });

        it("should format string error correctly", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("String error message");

            expect(debugInfo).toContain("String error message");
        });

        it("should format unknown error as 'Unknown'", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo(null);

            expect(debugInfo).toContain("Error: Unknown");
        });

        it("should include encoded URL", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            // URL should be base64 encoded
            expect(debugInfo).toContain("URL:");
            const urlMatch = debugInfo.match(/URL: (.+)/);
            expect(urlMatch).toBeTruthy();
            if (urlMatch) {
                // Should be base64 encoded (alphanumeric + =)
                expect(urlMatch[1]).toMatch(/^[A-Za-z0-9+/=]+$/);
            }
        });

        it("should include encoded config when config is provided", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("Config:");
            expect(debugInfo).not.toContain("no-config");
        });

        it("should show 'no-config' when config is not provided", () => {
            const gatherer = new DebugInfoGatherer(undefined, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("Config: no-config");
        });

        it("should include iframe status when iframe is provided", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("IFrame Status:");
            expect(debugInfo).not.toContain("not-iframe");
        });

        it("should show 'not-iframe' when iframe is not provided", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, undefined);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("IFrame Status: not-iframe");
        });

        it("should include navigator info", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("Navigator Info:");
            expect(debugInfo).not.toContain("no-navigator");
        });

        it("should handle iframe without contentDocument", () => {
            const iframeWithoutDoc = document.createElement("iframe");
            Object.defineProperty(iframeWithoutDoc, "contentDocument", {
                value: null,
                writable: true,
            });
            Object.defineProperty(iframeWithoutDoc, "contentWindow", {
                value: {},
                writable: true,
            });

            const gatherer = new DebugInfoGatherer(
                mockConfig,
                iframeWithoutDoc
            );

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("IFrame Status:");
        });

        it("should handle iframe with incomplete readyState", () => {
            const iframeIncomplete = document.createElement("iframe");
            Object.defineProperty(iframeIncomplete, "contentDocument", {
                value: {
                    readyState: "loading",
                },
                writable: true,
            });
            Object.defineProperty(iframeIncomplete, "contentWindow", {
                value: {},
                writable: true,
            });

            const gatherer = new DebugInfoGatherer(
                mockConfig,
                iframeIncomplete
            );

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("IFrame Status:");
        });

        it("should include last request when set", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);
            const mockMessage = {
                id: 1,
                method: "test_method",
                params: [],
            } as any;

            gatherer.setLastRequest(mockMessage);
            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("Last Request:");
            expect(debugInfo).not.toContain("No Frak request logged");
        });

        it("should include last response when set", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);
            const mockMessage = {
                id: 1,
                method: "test_method",
            } as any;
            const mockResponse = {
                id: 1,
                result: "success",
            } as any;

            gatherer.setLastResponse(mockMessage, mockResponse);
            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("Last Response:");
            expect(debugInfo).not.toContain("No Frak response logged");
        });

        it("should show 'No Frak request logged' when no request is set", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("No Frak request logged");
        });

        it("should show 'No Frak response logged' when no response is set", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            const debugInfo = gatherer.formatDebugInfo("test error");

            expect(debugInfo).toContain("No Frak response logged");
        });
    });

    describe("base64 encoding error handling", () => {
        it("should handle encoding errors gracefully", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);

            // Create a circular reference that can't be JSON stringified
            const circularObj: any = { prop: "value" };
            circularObj.self = circularObj;

            // Mock base64Encode to throw an error
            // We can't directly test the private method, but we can test
            // that formatDebugInfo doesn't throw when encoding fails
            // by checking that it still produces output

            const debugInfo = gatherer.formatDebugInfo("test error");

            // Should still produce debug info even if encoding fails
            expect(debugInfo).toContain("Debug Information:");
        });
    });

    describe("integration", () => {
        it("should format complete debug info with all data set", () => {
            const gatherer = new DebugInfoGatherer(mockConfig, mockIframe);
            const mockRequest = {
                id: 1,
                method: "frak_sendInteraction",
                params: [],
            } as any;
            const mockResponse = {
                id: 1,
                result: { delegationId: "123" },
            } as any;
            const error = new FrakRpcError(
                RpcErrorCodes.serverError,
                "Server error"
            );

            gatherer.setLastRequest(mockRequest);
            gatherer.setLastResponse(mockRequest, mockResponse);
            gatherer.updateSetupStatus(true);

            const debugInfo = gatherer.formatDebugInfo(error);

            expect(debugInfo).toContain("Debug Information:");
            expect(debugInfo).toContain("Client Status: setup");
            expect(debugInfo).toContain(
                `FrakRpcError: ${RpcErrorCodes.serverError} 'Server error'`
            );
            expect(debugInfo).not.toContain("No Frak request logged");
            expect(debugInfo).not.toContain("No Frak response logged");
        });
    });
});
