import { beforeEach, describe, expect, it, vi } from "vitest";

// Import factories before mocking to avoid hoisting issues
const { createMockAddress, createMockEcdsaSession, createMockSdkSession } =
    await vi.importActual<typeof import("@frak-labs/wallet-shared/test")>(
        "@frak-labs/wallet-shared/test"
    );

import {
    handleOpenSso,
    handlePrepareSso,
    handleSsoComplete,
    processSsoCompletion,
} from "./ssoHandler";

// Mock wallet-shared
const mockAddLastAuthentication = vi.fn(async () => {});
const mockEmitLifecycleEvent = vi.fn();
const mockTrackAuthCompleted = vi.fn(async () => {});
const mockSetSession = vi.fn();
const mockSetSdkSession = vi.fn();

vi.mock("@frak-labs/wallet-shared", () => ({
    get addLastAuthentication() {
        return mockAddLastAuthentication;
    },
    get emitLifecycleEvent() {
        return mockEmitLifecycleEvent;
    },
    get trackAuthCompleted() {
        return mockTrackAuthCompleted;
    },
    sessionStore: {
        getState: vi.fn(() => ({
            setSession: mockSetSession,
            setSdkSession: mockSetSdkSession,
        })),
    },
}));

// Mock core-sdk
const mockGenerateSsoUrl = vi.fn(() => "https://sso.example.com/auth");
vi.mock("@frak-labs/core-sdk", () => ({
    get generateSsoUrl() {
        return mockGenerateSsoUrl;
    },
}));

// Mock frame-connector
vi.mock("@frak-labs/frame-connector", () => {
    class MockFrakRpcError extends Error {
        code: number;
        constructor(code: number, message: string) {
            super(message);
            this.code = code;
            this.name = "FrakRpcError";
        }
    }

    class MockDeferred {
        promise: Promise<any>;
        resolve: (value: any) => void;
        reject: (error: any) => void;

        constructor() {
            let resolveRef: (value: any) => void;
            let rejectRef: (error: any) => void;

            this.promise = new Promise((resolve, reject) => {
                resolveRef = resolve;
                rejectRef = reject;
            });

            this.resolve = (value: any) => resolveRef(value);
            this.reject = (error: any) => rejectRef(error);
        }
    }

    return {
        Deferred: MockDeferred,
        FrakRpcError: MockFrakRpcError,
        RpcErrorCodes: {
            internalError: -32603,
        },
    };
});

describe("ssoHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe("processSsoCompletion", () => {
        const mockSession = createMockEcdsaSession({
            address: createMockAddress("abc123"),
            token: "test-token",
        });

        const mockSdkSession = createMockSdkSession({
            token: "sdk-token-123",
        });

        it("should successfully process SSO completion", async () => {
            await processSsoCompletion(mockSession, mockSdkSession);

            expect(mockAddLastAuthentication).toHaveBeenCalledWith(mockSession);
            expect(mockSetSession).toHaveBeenCalledWith(mockSession);
            expect(mockSetSdkSession).toHaveBeenCalledWith(mockSdkSession);
            expect(mockTrackAuthCompleted).toHaveBeenCalledWith(
                "sso",
                mockSession
            );
        });

        it("should complete without error when no pending request", async () => {
            // Just verify it doesn't throw when pendingSsoRequest is undefined
            await expect(
                processSsoCompletion(mockSession, mockSdkSession)
            ).resolves.not.toThrow();

            expect(mockAddLastAuthentication).toHaveBeenCalledWith(mockSession);
            expect(mockSetSession).toHaveBeenCalledWith(mockSession);
        });

        it("should handle session without token by adding empty string", async () => {
            const sessionWithoutToken = createMockEcdsaSession({
                address: createMockAddress("abc123"),
            });
            // Remove token to test edge case
            delete (sessionWithoutToken as any).token;

            await processSsoCompletion(
                sessionWithoutToken as any,
                mockSdkSession
            );

            // Should call with token: ""
            expect(mockSetSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: "",
                })
            );
        });

        it("should throw error on storage failure", async () => {
            const error = new Error("Storage failed");
            mockAddLastAuthentication.mockRejectedValueOnce(error);

            await expect(
                processSsoCompletion(mockSession, mockSdkSession)
            ).rejects.toThrow("Storage failed");
        });

        it("should log success message with wallet address", async () => {
            const consoleSpy = vi.spyOn(console, "log");

            await processSsoCompletion(mockSession, mockSdkSession);

            expect(consoleSpy).toHaveBeenCalledWith(
                "[SSO] Authentication completed successfully",
                {
                    address: mockSession.address,
                }
            );

            consoleSpy.mockRestore();
        });
    });

    describe("handleSsoComplete", () => {
        it("should process SSO completion and return success", async () => {
            const mockSession = createMockEcdsaSession({
                address: createMockAddress("abc123"),
                token: "test-token",
            });

            const mockSdkSession = createMockSdkSession({
                token: "sdk-token-123",
            });

            const result = await handleSsoComplete(
                [mockSession, mockSdkSession],
                {} as any
            );

            expect(result).toEqual({ success: true });
            expect(mockAddLastAuthentication).toHaveBeenCalled();
        });
    });

    describe("handlePrepareSso", () => {
        it("should generate SSO URL with correct parameters", async () => {
            const ssoInfo = {
                redirectUrl: "https://example.com/callback",
            };
            const name = "Test App";
            const css = "body { background: red; }";
            const context = { productId: "0x123" as `0x${string}` } as any;

            const result = await handlePrepareSso(
                [ssoInfo, name, css],
                context
            );

            expect(mockGenerateSsoUrl).toHaveBeenCalledWith(
                window.location.origin,
                ssoInfo,
                context.productId,
                name,
                css
            );
            expect(result).toEqual({ ssoUrl: "https://sso.example.com/auth" });
        });

        it("should work without optional parameters", async () => {
            const ssoInfo = {};
            const context = { productId: "0x456" as `0x${string}` } as any;

            const result = await handlePrepareSso(
                [ssoInfo, undefined, undefined] as any,
                context
            );

            expect(mockGenerateSsoUrl).toHaveBeenCalledWith(
                window.location.origin,
                ssoInfo,
                context.productId,
                undefined,
                undefined
            );
            expect(result).toEqual({ ssoUrl: "https://sso.example.com/auth" });
        });
    });

    describe("handleOpenSso", () => {
        const mockContext = {
            productId: "0x123" as `0x${string}`,
        } as any;

        it("should throw error if called server-side", async () => {
            const originalWindow = global.window;
            // @ts-expect-error
            delete global.window;

            const ssoInfo = {};

            await expect(
                handleOpenSso(
                    [ssoInfo, undefined, undefined] as any,
                    mockContext
                )
            ).rejects.toThrow("Server side not supported");

            global.window = originalWindow;
        });

        it("should handle redirect mode (openInSameWindow: true)", async () => {
            const ssoInfo = { openInSameWindow: true };

            const result = await handleOpenSso(
                [ssoInfo, "Test App", undefined],
                mockContext
            );

            expect(mockGenerateSsoUrl).toHaveBeenCalled();
            expect(mockEmitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: "https://sso.example.com/auth" },
            });
            expect(result).toEqual({ wallet: undefined });
        });

        it("should handle redirect mode (redirectUrl present)", async () => {
            const ssoInfo = { redirectUrl: "https://example.com/callback" };

            const result = await handleOpenSso(
                [ssoInfo, undefined, undefined] as any,
                mockContext
            );

            expect(mockEmitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: "https://sso.example.com/auth" },
            });
            expect(result).toEqual({ wallet: undefined });
        });

        it("should create deferred for popup mode", async () => {
            const ssoInfo = { openInSameWindow: false };

            // Start the handler (don't await, let it timeout)
            const promise = handleOpenSso(
                [ssoInfo, undefined, undefined] as any,
                mockContext
            );

            // Verify it's a promise (deferred was created)
            expect(promise).toBeInstanceOf(Promise);

            // Let it timeout naturally (tested separately)
        }, 200);

        it("should handle popup mode - timeout", async () => {
            vi.useFakeTimers();

            const ssoInfo = { openInSameWindow: false };

            const promise = handleOpenSso(
                [ssoInfo, undefined, undefined] as any,
                mockContext
            );

            // Fast-forward time to trigger timeout
            vi.advanceTimersByTime(120_000);

            await expect(promise).rejects.toThrow(
                "SSO timeout - no completion received within 120 seconds"
            );

            vi.useRealTimers();
        });
    });
});
