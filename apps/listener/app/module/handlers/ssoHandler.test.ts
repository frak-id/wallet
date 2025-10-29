import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
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
        test("should successfully process SSO completion", async ({
            mockSession,
            mockSdkSession,
        }) => {
            await processSsoCompletion(mockSession, mockSdkSession);

            expect(mockAddLastAuthentication).toHaveBeenCalledWith(mockSession);
            expect(mockSetSession).toHaveBeenCalledWith(mockSession);
            expect(mockSetSdkSession).toHaveBeenCalledWith(mockSdkSession);
            expect(mockTrackAuthCompleted).toHaveBeenCalledWith(
                "sso",
                mockSession
            );
        });

        test("should complete without error when no pending request", async ({
            mockSession,
            mockSdkSession,
        }) => {
            // Just verify it doesn't throw when pendingSsoRequest is undefined
            await expect(
                processSsoCompletion(mockSession, mockSdkSession)
            ).resolves.not.toThrow();

            expect(mockAddLastAuthentication).toHaveBeenCalledWith(mockSession);
            expect(mockSetSession).toHaveBeenCalledWith(mockSession);
        });

        test("should handle session without token by adding empty string", async ({
            mockAddress,
            mockSdkSession,
        }) => {
            const { createMockEcdsaSession } = await import(
                "@frak-labs/wallet-shared/test"
            );
            const sessionWithoutToken = createMockEcdsaSession({
                address: mockAddress,
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

        test("should throw error on storage failure", async ({
            mockSession,
            mockSdkSession,
        }) => {
            const error = new Error("Storage failed");
            mockAddLastAuthentication.mockRejectedValueOnce(error);

            await expect(
                processSsoCompletion(mockSession, mockSdkSession)
            ).rejects.toThrow("Storage failed");
        });

        test("should log success message with wallet address", async ({
            mockSession,
            mockSdkSession,
        }) => {
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
        test("should process SSO completion and return success", async ({
            mockSession,
            mockSdkSession,
        }) => {
            const result = await handleSsoComplete(
                [mockSession, mockSdkSession],
                {} as any
            );

            expect(result).toEqual({ success: true });
            expect(mockAddLastAuthentication).toHaveBeenCalled();
        });
    });

    describe("handlePrepareSso", () => {
        test("should generate SSO URL with correct parameters", async ({
            mockProductId,
        }) => {
            const ssoInfo = {
                redirectUrl: "https://example.com/callback",
            };
            const name = "Test App";
            const css = "body { background: red; }";
            const context = { productId: mockProductId } as any;

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

        test("should work without optional parameters", async ({
            mockProductId,
        }) => {
            const ssoInfo = {};
            const context = { productId: mockProductId } as any;

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
        test("should throw error if called server-side", async ({
            mockProductId,
        }) => {
            const mockContext = {
                productId: mockProductId,
            } as any;
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

        test("should handle redirect mode (openInSameWindow: true)", async ({
            mockProductId,
        }) => {
            const mockContext = {
                productId: mockProductId,
            } as any;
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

        test("should handle redirect mode (redirectUrl present)", async ({
            mockProductId,
        }) => {
            const mockContext = {
                productId: mockProductId,
            } as any;
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

        test("should create deferred for popup mode", async ({
            mockProductId,
        }) => {
            const mockContext = {
                productId: mockProductId,
            } as any;
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

        test("should handle popup mode - timeout", async ({
            mockProductId,
        }) => {
            const mockContext = {
                productId: mockProductId,
            } as any;
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
