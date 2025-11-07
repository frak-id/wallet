import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { walletContextMiddleware } from "./walletContext";

// Mock app-essentials
let mockIsRunningLocally = false;

vi.mock("@frak-labs/app-essentials", () => ({
    get isRunningLocally() {
        return mockIsRunningLocally;
    },
    isRunningInProd: false,
}));

describe("walletContextMiddleware", () => {
    beforeEach(() => {
        // Reset store state
        resolvingContextStore.setState({
            context: undefined,
            handshakeTokens: new Set(),
        });
        mockIsRunningLocally = false;
        vi.clearAllMocks();
    });

    describe("onRequest", () => {
        test("should throw error if no resolving context available", () => {
            const message = {
                id: "1",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const context = { origin: "https://example.com" };

            expect(() => {
                walletContextMiddleware.onRequest?.(
                    message as any,
                    context as any
                );
            }).toThrow(FrakRpcError);

            try {
                walletContextMiddleware.onRequest?.(
                    message as any,
                    context as any
                );
            } catch (error) {
                expect((error as FrakRpcError).code).toBe(
                    RpcErrorCodes.configError
                );
                expect((error as FrakRpcError).message).toContain(
                    "No resolving context available"
                );
            }
        });

        test("should handle same-origin messages from wallet window", () => {
            resolvingContextStore.setState({
                context: {
                    productId: "0x123" as `0x${string}`,
                    origin: "https://example.com",
                    sourceUrl: "https://example.com",
                    isAutoContext: false,
                },
            });

            const message = {
                id: "2",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const context = { origin: window.origin };

            const result = walletContextMiddleware.onRequest?.(
                message as any,
                context as any
            );

            expect(result).toEqual({
                ...context,
                productId: "0x",
                sourceUrl: context.origin,
                isAutoContext: false,
            });
        });

        test("should augment context with wallet fields when productId matches", () => {
            const storedContext = {
                productId:
                    "0x02438d3405cadd648e08dbff51bdbeb415913e642189100dc4a012064c870883" as `0x${string}`,
                origin: "https://example.com",
                sourceUrl: "https://example.com/page",
                isAutoContext: false,
            };
            resolvingContextStore.setState({ context: storedContext });

            const message = {
                id: "3",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const context = { origin: "https://example.com" };

            const result = walletContextMiddleware.onRequest?.(
                message as any,
                context as any
            );

            expect(result).toEqual({
                ...context,
                productId: storedContext.productId,
                sourceUrl: storedContext.sourceUrl,
                isAutoContext: storedContext.isAutoContext,
                walletReferrer: undefined,
            });
        });

        test("should include walletReferrer if present in stored context", () => {
            const storedContext = {
                productId:
                    "0x02438d3405cadd648e08dbff51bdbeb415913e642189100dc4a012064c870883" as `0x${string}`,
                origin: "https://example.com",
                sourceUrl: "https://example.com",
                isAutoContext: false,
                walletReferrer: "0xabc123" as `0x${string}`,
            };
            resolvingContextStore.setState({ context: storedContext });

            const message = {
                id: "4",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const context = { origin: "https://example.com" };

            const result = walletContextMiddleware.onRequest?.(
                message as any,
                context as any
            ) as any;

            expect(result?.walletReferrer).toBe("0xabc123");
        });

        test("should handle www prefix in origin correctly", () => {
            // Store context for example.com (normalized)
            const storedContext = {
                productId:
                    "0x02438d3405cadd648e08dbff51bdbeb415913e642189100dc4a012064c870883" as `0x${string}`,
                origin: "https://www.example.com",
                sourceUrl: "https://www.example.com",
                isAutoContext: false,
            };
            resolvingContextStore.setState({ context: storedContext });

            const message = {
                id: "5",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            // Request from www.example.com should compute same productId as example.com
            const context = { origin: "https://www.example.com" };

            const result = walletContextMiddleware.onRequest?.(
                message as any,
                context as any
            );

            expect(result).toEqual({
                ...context,
                productId: storedContext.productId,
                sourceUrl: storedContext.sourceUrl,
                isAutoContext: storedContext.isAutoContext,
                walletReferrer: undefined,
            });
        });

        test("should throw error for productId mismatch in production", () => {
            mockIsRunningLocally = false; // Already set in beforeEach, but being explicit

            const storedContext = {
                productId: "0x123" as `0x${string}`,
                origin: "https://example.com",
                sourceUrl: "https://example.com",
                isAutoContext: false,
            };
            resolvingContextStore.setState({ context: storedContext });

            const message = {
                id: "6",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const context = { origin: "https://different-domain.com" };

            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            expect(() => {
                walletContextMiddleware.onRequest?.(
                    message as any,
                    context as any
                );
            }).toThrow(FrakRpcError);

            try {
                walletContextMiddleware.onRequest?.(
                    message as any,
                    context as any
                );
            } catch (error) {
                expect((error as FrakRpcError).code).toBe(
                    RpcErrorCodes.configError
                );
                expect((error as FrakRpcError).message).toContain(
                    "Product ID mismatch"
                );
            }

            expect(consoleSpy).toHaveBeenCalledWith(
                "Mismatching product id, rejecting RPC request",
                expect.objectContaining({
                    origin: "https://different-domain.com",
                })
            );

            consoleSpy.mockRestore();
        });

        test("should allow productId mismatch in local development", () => {
            mockIsRunningLocally = true;

            const storedContext = {
                productId: "0x123" as `0x${string}`,
                origin: "https://example.com",
                sourceUrl: "https://example.com",
                isAutoContext: false,
            };
            resolvingContextStore.setState({ context: storedContext });

            const message = {
                id: "7",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const context = { origin: "https://different-domain.com" };

            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // Should not throw
            const result = walletContextMiddleware.onRequest?.(
                message as any,
                context as any
            ) as any;

            expect(result).toBeDefined();
            expect(result?.productId).toBe("0x123");

            consoleSpy.mockRestore();
        });

        test("should handle subdomain variations correctly", () => {
            const storedContext = {
                productId:
                    "0x02438d3405cadd648e08dbff51bdbeb415913e642189100dc4a012064c870883" as `0x${string}`,
                origin: "https://example.com",
                sourceUrl: "https://example.com",
                isAutoContext: false,
            };
            resolvingContextStore.setState({ context: storedContext });

            const message = {
                id: "8",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            // Subdomain should compute different productId
            const context = { origin: "https://subdomain.example.com" };

            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            expect(() => {
                walletContextMiddleware.onRequest?.(
                    message as any,
                    context as any
                );
            }).toThrow(FrakRpcError);

            consoleSpy.mockRestore();
        });

        test("should log debug message for same-origin requests", () => {
            resolvingContextStore.setState({
                context: {
                    productId: "0x123" as `0x${string}`,
                    origin: "https://example.com",
                    sourceUrl: "https://example.com",
                    isAutoContext: false,
                },
            });

            const consoleSpy = vi
                .spyOn(console, "debug")
                .mockImplementation(() => {});

            const message = {
                id: "9",
                topic: "frak_sendInteraction" as const,
                data: {},
            };
            const context = { origin: window.origin };

            walletContextMiddleware.onRequest?.(message as any, context as any);

            expect(consoleSpy).toHaveBeenCalledWith(
                "Received message from another wallet window, skipping context check",
                message,
                context
            );

            consoleSpy.mockRestore();
        });
    });
});
