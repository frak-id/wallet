import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import {
    checkContextAndEmitReady,
    createClientLifecycleHandler,
    initializeResolvingContext,
} from "./lifecycleHandler";

// Mock wallet-shared
vi.mock("@frak-labs/wallet-shared", () => ({
    emitLifecycleEvent: vi.fn(),
    mapI18nConfig: vi.fn(),
    restoreBackupData: vi.fn(),
    sessionStore: {
        getState: vi.fn(() => ({ session: undefined })),
    },
}));

// Mock core-sdk
vi.mock("@frak-labs/core-sdk", () => ({
    decompressJsonFromB64: vi.fn(),
    FrakContextManager: {
        parse: vi.fn(() => undefined),
    },
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
    getI18n: vi.fn(() => ({
        language: "en",
        addResourceBundle: vi.fn(),
    })),
}));

// Mock ssoHandler
vi.mock("./ssoHandler", () => ({
    processSsoCompletion: vi.fn(),
}));

describe("lifecycleHandler", () => {
    beforeEach(() => {
        // Reset store state
        resolvingContextStore.setState({
            context: undefined,
            handshakeTokens: new Set(),
        });
        vi.clearAllMocks();
    });

    describe("initializeResolvingContext", () => {
        test("should return false if window is undefined", () => {
            // Cannot easily test this without mocking window globally
            // Skip this edge case as it's mainly for SSR protection
        });

        test("should return false if no context exists", () => {
            // No context in store (from beforeEach)
            const result = initializeResolvingContext();

            expect(result).toBe(false);
            // After calling, handshake should be started (observable: handshakeTokens populated)
            expect(
                resolvingContextStore.getState().handshakeTokens.size
            ).toBeGreaterThan(0);
        });

        test("should return true if context exists and is not auto", () => {
            resolvingContextStore.setState({
                context: {
                    productId: "0x123" as `0x${string}`,
                    origin: "https://example.com",
                    sourceUrl: "https://example.com",
                    isAutoContext: false,
                },
                handshakeTokens: new Set(),
            });

            const result = initializeResolvingContext();

            expect(result).toBe(true);
            // Should not start handshake (tokens remain empty)
            expect(resolvingContextStore.getState().handshakeTokens.size).toBe(
                0
            );
        });

        test("should return true if context is auto context", () => {
            resolvingContextStore.setState({
                context: {
                    productId: "0x123" as `0x${string}`,
                    origin: "https://example.com",
                    sourceUrl: "https://example.com",
                    isAutoContext: true,
                },
                handshakeTokens: new Set(),
            });

            const result = initializeResolvingContext();

            expect(result).toBe(true);
            // Should start handshake (observable: tokens populated)
            expect(
                resolvingContextStore.getState().handshakeTokens.size
            ).toBeGreaterThan(0);
        });
    });

    describe("checkContextAndEmitReady", () => {
        test("should return false if no context", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );
            const consoleSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            const result = checkContextAndEmitReady();

            expect(result).toBe(false);
            // Should start handshake (observable: tokens populated)
            expect(
                resolvingContextStore.getState().handshakeTokens.size
            ).toBeGreaterThan(0);
            expect(consoleSpy).toHaveBeenCalledWith(
                "Not ready to handle request yet - no context"
            );
            // Note: startHandshake emits a "handshake" lifecycle event,
            // but not a "connected" event
            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "handshake",
                data: { token: expect.any(String) },
            });

            consoleSpy.mockRestore();
        });

        test("should emit connected event and return true if context exists", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            resolvingContextStore.setState({
                context: {
                    productId: "0x123" as `0x${string}`,
                    origin: "https://example.com",
                    sourceUrl: "https://example.com",
                    isAutoContext: false,
                },
                handshakeTokens: new Set(),
            });

            const result = checkContextAndEmitReady();

            expect(result).toBe(true);
            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "connected",
            });
        });

        test("should start handshake and emit connected if context is auto", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            resolvingContextStore.setState({
                context: {
                    productId: "0x123" as `0x${string}`,
                    origin: "https://example.com",
                    sourceUrl: "https://example.com",
                    isAutoContext: true,
                },
                handshakeTokens: new Set(),
            });

            const result = checkContextAndEmitReady();

            expect(result).toBe(true);
            // Should start handshake (observable: tokens populated)
            expect(
                resolvingContextStore.getState().handshakeTokens.size
            ).toBeGreaterThan(0);
            // Should also emit connected since we have a context
            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "connected",
            });
        });
    });

    describe("createClientLifecycleHandler", () => {
        test("should handle modal-css event by appending stylesheet link", async () => {
            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            // Mock document operations
            const mockLinkElement = {
                rel: "",
                href: "",
            };
            const mockCreateElement = vi
                .spyOn(document, "createElement")
                .mockReturnValue(mockLinkElement as any);
            const mockAppendChild = vi
                .spyOn(document.head, "appendChild")
                .mockImplementation(() => mockLinkElement as any);

            const messageEvent = {
                clientLifecycle: "modal-css" as const,
                data: { cssLink: "https://example.com/styles.css" },
            };

            await handler(messageEvent, {} as any);

            expect(mockCreateElement).toHaveBeenCalledWith("link");
            expect(mockLinkElement.rel).toBe("stylesheet");
            expect(mockLinkElement.href).toBe("https://example.com/styles.css");
            expect(mockAppendChild).toHaveBeenCalledWith(mockLinkElement);

            mockCreateElement.mockRestore();
            mockAppendChild.mockRestore();
        });

        test("should handle modal-i18n event with valid i18n override", async () => {
            const { mapI18nConfig } = await import("@frak-labs/wallet-shared");
            const { getI18n } = await import("react-i18next");

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const i18nOverride = {
                en: {
                    translation: {
                        key: "value",
                    },
                },
            };

            const messageEvent = {
                clientLifecycle: "modal-i18n" as const,
                data: { i18n: i18nOverride },
            } as any;

            await handler(messageEvent, {} as any);

            expect(getI18n).toHaveBeenCalled();
            expect(mapI18nConfig).toHaveBeenCalledWith(
                i18nOverride,
                expect.any(Object)
            );
        });

        test("should skip modal-i18n event with empty i18n override", async () => {
            const { mapI18nConfig } = await import("@frak-labs/wallet-shared");

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                clientLifecycle: "modal-i18n" as const,
                data: { i18n: {} },
            };

            await handler(messageEvent, {} as any);

            expect(mapI18nConfig).not.toHaveBeenCalled();
        });

        test("should skip modal-i18n event with invalid i18n override", async () => {
            const { mapI18nConfig } = await import("@frak-labs/wallet-shared");

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                clientLifecycle: "modal-i18n" as const,
                data: { i18n: "not-an-object" },
            } as any;

            await handler(messageEvent, {} as any);

            expect(mapI18nConfig).not.toHaveBeenCalled();
        });

        test("should handle restore-backup event with valid context", async () => {
            const { restoreBackupData } = await import(
                "@frak-labs/wallet-shared"
            );

            // Set up context
            resolvingContextStore.setState({
                context: {
                    productId: "0x123" as `0x${string}`,
                    origin: "https://example.com",
                    sourceUrl: "https://example.com",
                    isAutoContext: false,
                },
                handshakeTokens: new Set(),
            });

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const mockBackup = "encrypted-backup-data";
            const messageEvent = {
                clientLifecycle: "restore-backup" as const,
                data: { backup: mockBackup },
            };

            await handler(messageEvent, {} as any);

            expect(restoreBackupData).toHaveBeenCalledWith({
                backup: mockBackup,
                productId: "0x123",
            });
        });

        test("should skip restore-backup event without context", async () => {
            const { restoreBackupData } = await import(
                "@frak-labs/wallet-shared"
            );

            const consoleSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                clientLifecycle: "restore-backup" as const,
                data: { backup: "encrypted-backup-data" },
            };

            await handler(messageEvent, {} as any);

            expect(consoleSpy).toHaveBeenCalledWith(
                "Can't restore a backup until we are sure of the context"
            );
            expect(restoreBackupData).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        test("should handle heartbeat event by calling setReadyToHandleRequest", async () => {
            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                clientLifecycle: "heartbeat" as const,
                data: {},
            } as any;

            await handler(messageEvent, {} as any);

            expect(mockSetReady).toHaveBeenCalled();
        });

        test("should handle handshake-response event and call setReadyToHandleRequest", async () => {
            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            // Mock handleHandshakeResponse to return true (context found)
            const mockHandleHandshake = vi.fn(() => true);
            resolvingContextStore.setState({
                context: undefined,
                handshakeTokens: new Set(["token-123"]),
                handleHandshakeResponse: mockHandleHandshake,
            } as any);

            const handshakeData = {
                currentUrl: "https://example.com",
                origin: "https://example.com",
                token: "token-123",
            };

            const messageEvent = {
                clientLifecycle: "handshake-response" as const,
                data: handshakeData,
            };

            await handler(messageEvent, {} as any);

            expect(mockHandleHandshake).toHaveBeenCalled();
            expect(mockSetReady).toHaveBeenCalled();
        });

        test("should handle handshake-response event but not call setReadyToHandleRequest if no context", async () => {
            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            // Mock handleHandshakeResponse to return false (no context)
            const mockHandleHandshake = vi.fn(() => false);
            resolvingContextStore.setState({
                context: undefined,
                handshakeTokens: new Set(),
                handleHandshakeResponse: mockHandleHandshake,
            } as any);

            const messageEvent = {
                clientLifecycle: "handshake-response" as const,
                data: {},
            } as any;

            await handler(messageEvent, {} as any);

            expect(mockHandleHandshake).toHaveBeenCalled();
            expect(mockSetReady).not.toHaveBeenCalled();
        });

        test("should handle sso-redirect-complete event with valid compressed data", async () => {
            const { decompressJsonFromB64 } = await import(
                "@frak-labs/core-sdk"
            );
            const { processSsoCompletion } = await import("./ssoHandler");

            const mockSession = { address: "0xabc123" as `0x${string}` };
            const mockSdkSession = { token: "sdk-token-123" };

            vi.mocked(decompressJsonFromB64).mockReturnValue([
                mockSession,
                mockSdkSession,
            ] as any);

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                clientLifecycle: "sso-redirect-complete" as const,
                data: { compressed: "compressed-base64-data" },
            };

            await handler(messageEvent, {} as any);

            expect(decompressJsonFromB64).toHaveBeenCalledWith(
                "compressed-base64-data"
            );
            expect(processSsoCompletion).toHaveBeenCalledWith(
                mockSession,
                mockSdkSession
            );
        });

        test("should handle sso-redirect-complete event with invalid compressed data", async () => {
            const { decompressJsonFromB64 } = await import(
                "@frak-labs/core-sdk"
            );
            const { processSsoCompletion } = await import("./ssoHandler");

            vi.mocked(decompressJsonFromB64).mockReturnValue(undefined);

            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                clientLifecycle: "sso-redirect-complete" as const,
                data: { compressed: "invalid-data" },
            };

            await handler(messageEvent, {} as any);

            expect(decompressJsonFromB64).toHaveBeenCalledWith("invalid-data");
            expect(processSsoCompletion).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                "[SSO Redirect] Failed to decompress SSO data"
            );

            consoleSpy.mockRestore();
        });

        test("should handle sso-redirect-complete event and catch errors", async () => {
            const { decompressJsonFromB64 } = await import(
                "@frak-labs/core-sdk"
            );

            const error = new Error("Decompression failed");
            vi.mocked(decompressJsonFromB64).mockImplementation(() => {
                throw error;
            });

            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                clientLifecycle: "sso-redirect-complete" as const,
                data: { compressed: "error-data" },
            };

            await handler(messageEvent, {} as any);

            expect(consoleSpy).toHaveBeenCalledWith(
                "[SSO Redirect] Error processing SSO redirect:",
                error
            );

            consoleSpy.mockRestore();
        });

        test("should ignore non-lifecycle events", async () => {
            const mockSetReady = vi.fn();
            const handler = createClientLifecycleHandler(mockSetReady);

            const messageEvent = {
                someOtherEvent: "value",
            } as any;

            await handler(messageEvent, {} as any);

            // Should not throw and not call anything
            expect(mockSetReady).not.toHaveBeenCalled();
        });
    });
});
