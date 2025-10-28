import type { ClientLifecycleEvent } from "@frak-labs/core-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvingContextStore } from "./resolvingContextStore";

// Mock wallet-shared imports
vi.mock("@frak-labs/wallet-shared", () => ({
    emitLifecycleEvent: vi.fn(),
    sessionStore: {
        getState: vi.fn(() => ({ session: undefined })),
    },
    updateGlobalProperties: vi.fn(),
}));

// Mock FrakContextManager
vi.mock("@frak-labs/core-sdk", () => ({
    FrakContextManager: {
        parse: vi.fn(() => undefined),
    },
}));

describe("resolvingContextStore", () => {
    beforeEach(() => {
        // Reset store state
        resolvingContextStore.setState({
            context: undefined,
            handshakeTokens: new Set(),
        });
        vi.clearAllMocks();
    });

    describe("startHandshake", () => {
        it("should generate and add handshake token", () => {
            const { startHandshake, handshakeTokens } =
                resolvingContextStore.getState();

            expect(handshakeTokens.size).toBe(0);

            startHandshake();

            const updatedTokens =
                resolvingContextStore.getState().handshakeTokens;
            expect(updatedTokens.size).toBe(1);
        });

        it("should emit handshake lifecycle event", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            resolvingContextStore.getState().startHandshake();

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "handshake",
                data: { token: expect.any(String) },
            });
        });

        it("should not add token if more than 10 tokens exist", () => {
            const { startHandshake } = resolvingContextStore.getState();
            const consoleSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            // Add 11 tokens
            const tokens = new Set(
                Array.from({ length: 11 }, (_, i) => `token-${i}`)
            );
            resolvingContextStore.setState({ handshakeTokens: tokens });

            startHandshake();

            expect(resolvingContextStore.getState().handshakeTokens.size).toBe(
                11
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                "Too many handshake tokens without response, skipping"
            );

            consoleSpy.mockRestore();
        });

        it("should generate unique tokens", () => {
            const { startHandshake } = resolvingContextStore.getState();

            startHandshake();
            startHandshake();
            startHandshake();

            const tokens = resolvingContextStore.getState().handshakeTokens;
            expect(tokens.size).toBe(3);
        });
    });

    describe("handleHandshakeResponse", () => {
        it("should reject invalid event type", () => {
            const { handleHandshakeResponse } =
                resolvingContextStore.getState();
            const consoleSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            const invalidEvent = {
                data: { clientLifecycle: "invalid" },
            } as any;

            const result = handleHandshakeResponse(invalidEvent);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                "Invalid handshake event type"
            );

            consoleSpy.mockRestore();
        });

        it("should reject event without token", () => {
            const { handleHandshakeResponse } =
                resolvingContextStore.getState();
            const consoleSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            const eventWithoutToken = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {},
                },
            } as any;

            const result = handleHandshakeResponse(eventWithoutToken);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it("should reject unrecognized token", () => {
            const { handleHandshakeResponse } =
                resolvingContextStore.getState();
            const consoleSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            const event: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: { token: "unknown-token" },
                },
                origin: "https://example.com",
            } as any;

            const result = handleHandshakeResponse(event);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                "Invalid handshake token unknown-token"
            );

            consoleSpy.mockRestore();
        });

        it("should accept valid handshake response and set context", () => {
            const { startHandshake, handleHandshakeResponse } =
                resolvingContextStore.getState();

            // Start handshake to get a token
            startHandshake();
            const tokens = resolvingContextStore.getState().handshakeTokens;
            const token = Array.from(tokens)[0];

            const event: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {
                        token,
                        currentUrl: "https://example.com/page",
                    },
                },
                origin: "https://example.com",
            } as any;

            const result = handleHandshakeResponse(event);

            expect(result).toBe(true);
            const context = resolvingContextStore.getState().context;
            expect(context).toBeDefined();
            expect(context?.sourceUrl).toBe("https://example.com/page");
            expect(context?.origin).toBe("https://example.com");
            expect(context?.isAutoContext).toBe(false);
        });

        it("should remove token after successful handshake", () => {
            const { startHandshake, handleHandshakeResponse } =
                resolvingContextStore.getState();

            startHandshake();
            const tokens = resolvingContextStore.getState().handshakeTokens;
            const token = Array.from(tokens)[0];
            expect(tokens.size).toBe(1);

            const event: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {
                        token,
                        currentUrl: "https://example.com",
                    },
                },
                origin: "https://example.com",
            } as any;

            handleHandshakeResponse(event);

            const updatedTokens =
                resolvingContextStore.getState().handshakeTokens;
            expect(updatedTokens.size).toBe(0);
        });

        it("should compute productId from normalized domain", () => {
            const { startHandshake, handleHandshakeResponse } =
                resolvingContextStore.getState();

            startHandshake();
            const token = Array.from(
                resolvingContextStore.getState().handshakeTokens
            )[0];

            const event: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {
                        token,
                        currentUrl: "https://www.example.com/page",
                    },
                },
                origin: "https://www.example.com",
            } as any;

            handleHandshakeResponse(event);

            const context = resolvingContextStore.getState().context;
            expect(context?.productId).toBeDefined();
            expect(context?.productId).toMatch(/^0x[a-f0-9]{64}$/);
        });

        it("should update global properties on context change", async () => {
            const { updateGlobalProperties } = await import(
                "@frak-labs/wallet-shared"
            );
            const { startHandshake, handleHandshakeResponse } =
                resolvingContextStore.getState();

            startHandshake();
            const token = Array.from(
                resolvingContextStore.getState().handshakeTokens
            )[0];

            const event: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {
                        token,
                        currentUrl: "https://example.com",
                    },
                },
                origin: "https://example.com",
            } as any;

            handleHandshakeResponse(event);

            expect(updateGlobalProperties).toHaveBeenCalledWith({
                isIframe: true,
                productId: expect.any(String),
                contextUrl: "https://example.com",
                contextReferrer: undefined,
            });
        });

        it("should not update context if sourceUrl and isAutoContext are same", async () => {
            const { updateGlobalProperties } = await import(
                "@frak-labs/wallet-shared"
            );

            // Set initial context
            const initialContext = {
                productId: "0x123" as `0x${string}`,
                origin: "https://example.com",
                sourceUrl: "https://example.com",
                isAutoContext: false,
            };
            resolvingContextStore.setState({ context: initialContext });

            const { startHandshake, handleHandshakeResponse } =
                resolvingContextStore.getState();
            startHandshake();
            const token = Array.from(
                resolvingContextStore.getState().handshakeTokens
            )[0];

            vi.clearAllMocks();

            const event: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {
                        token,
                        currentUrl: "https://example.com",
                    },
                },
                origin: "https://example.com",
            } as any;

            handleHandshakeResponse(event);

            // Should not call updateGlobalProperties since context hasn't changed
            expect(updateGlobalProperties).not.toHaveBeenCalled();
        });
    });

    describe("setContext", () => {
        it("should set context", () => {
            const { setContext } = resolvingContextStore.getState();

            const context = {
                productId: "0xabc" as `0x${string}`,
                origin: "https://test.com",
                sourceUrl: "https://test.com",
                isAutoContext: true,
            };

            setContext(context);

            expect(resolvingContextStore.getState().context).toEqual(context);
        });

        it("should allow setting context to undefined", () => {
            const { setContext } = resolvingContextStore.getState();

            // Set a context first
            setContext({
                productId: "0xabc" as `0x${string}`,
                origin: "https://test.com",
                sourceUrl: "https://test.com",
                isAutoContext: true,
            });

            // Then set to undefined
            setContext(undefined);

            expect(resolvingContextStore.getState().context).toBeUndefined();
        });
    });

    describe("clearContext", () => {
        it("should clear context", () => {
            const { setContext, clearContext } =
                resolvingContextStore.getState();

            // Set a context first
            setContext({
                productId: "0xabc" as `0x${string}`,
                origin: "https://test.com",
                sourceUrl: "https://test.com",
                isAutoContext: true,
            });

            expect(resolvingContextStore.getState().context).toBeDefined();

            // Clear it
            clearContext();

            expect(resolvingContextStore.getState().context).toBeUndefined();
        });
    });

    describe("Edge cases", () => {
        it("should handle event with origin but no currentUrl", () => {
            const { startHandshake, handleHandshakeResponse } =
                resolvingContextStore.getState();

            startHandshake();
            const token = Array.from(
                resolvingContextStore.getState().handshakeTokens
            )[0];

            const event: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: { token },
                },
                origin: "https://fallback.com",
            } as any;

            const result = handleHandshakeResponse(event);

            expect(result).toBe(true);
            const context = resolvingContextStore.getState().context;
            expect(context?.sourceUrl).toBe("https://fallback.com");
        });

        it("should handle www prefix correctly", () => {
            const { startHandshake, handleHandshakeResponse } =
                resolvingContextStore.getState();

            startHandshake();
            const token = Array.from(
                resolvingContextStore.getState().handshakeTokens
            )[0];

            const event1: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {
                        token,
                        currentUrl: "https://www.example.com",
                    },
                },
                origin: "https://www.example.com",
            } as any;

            handleHandshakeResponse(event1);
            const productId1 =
                resolvingContextStore.getState().context?.productId;

            // Reset and try without www
            resolvingContextStore.setState({
                context: undefined,
                handshakeTokens: new Set(),
            });

            startHandshake();
            const token2 = Array.from(
                resolvingContextStore.getState().handshakeTokens
            )[0];

            const event2: MessageEvent<ClientLifecycleEvent> = {
                data: {
                    clientLifecycle: "handshake-response",
                    data: {
                        token: token2,
                        currentUrl: "https://example.com",
                    },
                },
                origin: "https://example.com",
            } as any;

            handleHandshakeResponse(event2);
            const productId2 =
                resolvingContextStore.getState().context?.productId;

            // ProductIds should be the same (www is normalized)
            expect(productId1).toBe(productId2);
        });
    });
});
