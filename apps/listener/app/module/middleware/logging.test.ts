import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { loggingMiddleware } from "./logging";

// Mock app-essentials
let mockIsRunningLocally = false;

vi.mock("@frak-labs/app-essentials", () => ({
    get isRunningLocally() {
        return mockIsRunningLocally;
    },
    isRunningInProd: false,
}));

describe("loggingMiddleware", () => {
    beforeEach(() => {
        mockIsRunningLocally = false;
        vi.clearAllMocks();
    });

    describe("onRequest", () => {
        test("should return context unchanged in production", () => {
            mockIsRunningLocally = false;

            const message = {
                id: "req-123",
                topic: "frak_sendInteraction" as const,
                data: { foo: "bar" },
            };
            const context = { origin: "https://example.com" };

            const result = loggingMiddleware.onRequest?.(
                message as any,
                context as any
            );

            expect(result).toBe(context);
        });

        test("should log request in local development", () => {
            mockIsRunningLocally = true;

            const consoleSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            const message = {
                id: "req-123",
                topic: "frak_sendInteraction" as const,
                data: { foo: "bar" },
            };
            const context = { origin: "https://example.com" };

            const result = loggingMiddleware.onRequest?.(
                message as any,
                context as any
            );

            expect(result).toBe(context);
            expect(consoleSpy).toHaveBeenCalledWith("[Wallet RPC] Request:", {
                topic: "frak_sendInteraction",
                origin: "https://example.com",
                id: "req-123",
                hasData: { foo: "bar" },
            });

            consoleSpy.mockRestore();
        });

        test("should not log request data content, only presence", () => {
            mockIsRunningLocally = true;

            const consoleSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            const message = {
                id: "req-456",
                topic: "frak_openSso" as const,
                data: { sensitiveData: "secret" },
            };
            const context = { origin: "https://example.com" };

            loggingMiddleware.onRequest?.(message as any, context as any);

            const logCall = consoleSpy.mock.calls[0];
            expect(logCall[1]).toHaveProperty("hasData");
            expect(logCall[1]).not.toHaveProperty("data");

            consoleSpy.mockRestore();
        });
    });

    describe("onResponse", () => {
        test("should return response unchanged in production", () => {
            mockIsRunningLocally = false;

            const message = {
                id: "req-123",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const response = { result: { success: true } };
            const context = { origin: "https://example.com" };

            const result = loggingMiddleware.onResponse?.(
                message as any,
                response as any,
                context as any
            );

            expect(result).toBe(response);
        });

        test("should log success response in local development", () => {
            mockIsRunningLocally = true;

            const consoleSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            const message = {
                id: "req-123",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const response = { result: { success: true } };
            const context = { origin: "https://example.com" };

            const result = loggingMiddleware.onResponse?.(
                message as any,
                response as any,
                context as any
            );

            expect(result).toBe(response);
            expect(consoleSpy).toHaveBeenCalledWith(
                "[Wallet RPC] Success response:",
                {
                    topic: "frak_sendInteraction",
                    origin: "https://example.com",
                    id: "req-123",
                    hasResult: { success: true },
                }
            );

            consoleSpy.mockRestore();
        });

        test("should log error response in local development", () => {
            mockIsRunningLocally = true;

            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const message = {
                id: "req-456",
                topic: "frak_openSso" as const,
                data: {},
            };
            const response = {
                error: { code: 500, message: "Internal error" },
            };
            const context = { origin: "https://example.com" };

            const result = loggingMiddleware.onResponse?.(
                message as any,
                response as any,
                context as any
            );

            expect(result).toBe(response);
            expect(consoleSpy).toHaveBeenCalledWith(
                "[Wallet RPC] Error response:",
                {
                    topic: "frak_openSso",
                    origin: "https://example.com",
                    id: "req-456",
                    error: { code: 500, message: "Internal error" },
                }
            );

            consoleSpy.mockRestore();
        });

        test("should not log response result content, only presence", () => {
            mockIsRunningLocally = true;

            const consoleSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            const message = {
                id: "req-789",
                topic: "frak_listenToWalletStatus" as const,
                data: {},
            };
            const response = { result: { sensitiveData: "secret" } };
            const context = { origin: "https://example.com" };

            loggingMiddleware.onResponse?.(
                message as any,
                response as any,
                context as any
            );

            const logCall = consoleSpy.mock.calls[0];
            expect(logCall[1]).toHaveProperty("hasResult");
            expect(logCall[1]).not.toHaveProperty("result");

            consoleSpy.mockRestore();
        });

        test("should handle response with both result and error gracefully", () => {
            mockIsRunningLocally = true;

            const consoleLogSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});
            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const message = {
                id: "req-999",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            // Edge case: response with error should use error path
            const response = {
                result: { foo: "bar" },
                error: { code: 400, message: "Bad request" },
            };
            const context = { origin: "https://example.com" };

            loggingMiddleware.onResponse?.(
                message as any,
                response as any,
                context as any
            );

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();

            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
    });
});
