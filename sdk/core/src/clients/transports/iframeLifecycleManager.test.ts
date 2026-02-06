import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock dependencies
vi.mock("@frak-labs/frame-connector", () => ({
    Deferred: class {
        promise: Promise<any>;
        resolve!: (value: any) => void;
        reject!: (error: any) => void;

        constructor() {
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
            });
        }
    },
}));

vi.mock("../../utils/constants", () => ({
    BACKUP_KEY: "frak-backup-key",
}));

vi.mock("../../utils/iframeHelper", () => ({
    changeIframeVisibility: vi.fn(),
}));

vi.mock("../../utils/clientId", () => ({
    getClientId: vi.fn(() => "mock-client-id-12345"),
}));

vi.mock("../../utils/deepLinkWithFallback", () => ({
    isFrakDeepLink: vi.fn((url: string) => url.startsWith("frakwallet://")),
    triggerDeepLinkWithFallback: vi.fn(),
}));

const WALLET_ORIGIN = "https://wallet.frak.id";

describe("createIFrameLifecycleManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset localStorage
        localStorage.clear();
        // Mock window.location
        Object.defineProperty(window, "location", {
            value: { href: "https://test.com" },
            writable: true,
        });
    });

    describe("manager initialization", () => {
        test("should create manager with correct properties", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            expect(manager).toBeDefined();
            expect(manager.isConnected).toBeInstanceOf(Promise);
            expect(manager.handleEvent).toBeInstanceOf(Function);
        });

        test("should start with unresolved isConnected promise", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            let resolved = false;
            manager.isConnected.then(() => {
                resolved = true;
            });

            // Wait a tick
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(resolved).toBe(false);
        });
    });

    describe("connected event", () => {
        test("should resolve isConnected on connected event", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "connected" as const,
            };

            await manager.handleEvent(event);

            await expect(manager.isConnected).resolves.toBe(true);
        });
    });

    describe("backup events", () => {
        test("should save backup to localStorage on do-backup", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const backup = "encrypted-backup-data";
            const event = {
                iframeLifecycle: "do-backup" as const,
                data: { backup },
            };

            await manager.handleEvent(event);

            expect(localStorage.getItem("frak-backup-key")).toBe(backup);
        });

        test("should remove backup when data.backup is undefined", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            // First set a backup
            localStorage.setItem("frak-backup-key", "old-backup");

            const event = {
                iframeLifecycle: "do-backup" as const,
                data: {},
            };

            await manager.handleEvent(event);

            expect(localStorage.getItem("frak-backup-key")).toBeNull();
        });

        test("should remove backup on remove-backup event", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            // First set a backup
            localStorage.setItem("frak-backup-key", "backup-to-remove");

            const event = {
                iframeLifecycle: "remove-backup" as const,
            };

            await manager.handleEvent(event);

            expect(localStorage.getItem("frak-backup-key")).toBeNull();
        });
    });

    describe("visibility events", () => {
        test("should show iframe on show event", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );
            const { changeIframeVisibility } = await import(
                "../../utils/iframeHelper"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "show" as const,
            };

            await manager.handleEvent(event);

            expect(changeIframeVisibility).toHaveBeenCalledWith({
                iframe: mockIframe,
                isVisible: true,
            });
        });

        test("should hide iframe on hide event", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );
            const { changeIframeVisibility } = await import(
                "../../utils/iframeHelper"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "hide" as const,
            };

            await manager.handleEvent(event);

            expect(changeIframeVisibility).toHaveBeenCalledWith({
                iframe: mockIframe,
                isVisible: false,
            });
        });
    });

    describe("handshake event", () => {
        test("should post handshake-response with token to iframe origin", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockPostMessage = vi.fn();
            const mockIframe = {
                src: "https://wallet.frak.id/listener",
                contentWindow: {
                    postMessage: mockPostMessage,
                },
            } as any;

            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "handshake" as const,
                data: { token: "handshake-token-123" },
            };

            await manager.handleEvent(event);

            expect(mockPostMessage).toHaveBeenCalledWith(
                {
                    clientLifecycle: "handshake-response",
                    data: {
                        token: "handshake-token-123",
                        currentUrl: "https://test.com",
                        clientId: "mock-client-id-12345",
                    },
                },
                "https://wallet.frak.id"
            );
        });

        test("should include current URL in handshake response", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            Object.defineProperty(window, "location", {
                value: { href: "https://example.com/page?param=value" },
                writable: true,
            });

            const mockPostMessage = vi.fn();
            const mockIframe = {
                src: "https://wallet.frak.id/listener",
                contentWindow: {
                    postMessage: mockPostMessage,
                },
            } as any;

            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "handshake" as const,
                data: { token: "token" },
            };

            await manager.handleEvent(event);

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        currentUrl: "https://example.com/page?param=value",
                    }),
                }),
                "https://wallet.frak.id"
            );
        });
    });

    describe("redirect event", () => {
        test("should redirect with appended current URL for HTTP URLs", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            Object.defineProperty(window, "location", {
                value: {
                    href: "https://original.com",
                },
                writable: true,
            });

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "redirect" as const,
                data: {
                    baseRedirectUrl: "https://redirect.com?u=placeholder",
                },
            };

            await manager.handleEvent(event);

            expect(window.location.href).toBe(
                "https://redirect.com/?u=https%3A%2F%2Foriginal.com"
            );
        });

        test("should redirect without modification if no u parameter", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            Object.defineProperty(window, "location", {
                value: {
                    href: "https://original.com",
                },
                writable: true,
            });

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "redirect" as const,
                data: {
                    baseRedirectUrl: "https://redirect.com/path",
                },
            };

            await manager.handleEvent(event);

            expect(window.location.href).toBe("https://redirect.com/path");
        });

        test("should use fallback detection for frakwallet:// deep links", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );
            const { triggerDeepLinkWithFallback } = await import(
                "../../utils/deepLinkWithFallback"
            );

            Object.defineProperty(window, "location", {
                value: {
                    href: "https://original.com",
                },
                writable: true,
            });

            const mockIframe = document.createElement("iframe");
            mockIframe.src = "https://wallet.frak.id";
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "redirect" as const,
                data: {
                    baseRedirectUrl: "frakwallet://wallet",
                },
            };

            await manager.handleEvent(event);

            expect(triggerDeepLinkWithFallback).toHaveBeenCalledWith(
                "frakwallet://wallet",
                expect.objectContaining({
                    onFallback: expect.any(Function),
                })
            );
        });

        test("should post deep-link-failed message when fallback is triggered", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );
            const { triggerDeepLinkWithFallback } = await import(
                "../../utils/deepLinkWithFallback"
            );

            Object.defineProperty(window, "location", {
                value: {
                    href: "https://original.com",
                },
                writable: true,
            });

            const mockPostMessage = vi.fn();
            const mockIframe = {
                src: "https://wallet.frak.id",
                contentWindow: {
                    postMessage: mockPostMessage,
                },
            } as any;

            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "redirect" as const,
                data: {
                    baseRedirectUrl: "frakwallet://wallet",
                },
            };

            await manager.handleEvent(event);

            // Extract the onFallback callback from the mock call
            const callArgs = (triggerDeepLinkWithFallback as any).mock.calls[0];
            const options = callArgs[1];
            expect(options).toBeDefined();
            expect(options.onFallback).toBeInstanceOf(Function);

            // Trigger the fallback callback
            options.onFallback();

            // Verify postMessage was called with deep-link-failed event
            expect(mockPostMessage).toHaveBeenCalledWith(
                {
                    clientLifecycle: "deep-link-failed",
                    data: { originalUrl: "frakwallet://wallet" },
                },
                "https://wallet.frak.id"
            );
        });

        test("should NOT use fallback detection for HTTP URLs", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );
            const { triggerDeepLinkWithFallback } = await import(
                "../../utils/deepLinkWithFallback"
            );

            Object.defineProperty(window, "location", {
                value: {
                    href: "https://original.com",
                },
                writable: true,
            });

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                iframeLifecycle: "redirect" as const,
                data: {
                    baseRedirectUrl: "https://wallet.frak.id/login",
                },
            };

            await manager.handleEvent(event);

            // Should NOT call fallback detection
            expect(triggerDeepLinkWithFallback).not.toHaveBeenCalled();
            // Should directly redirect
            expect(window.location.href).toBe("https://wallet.frak.id/login");
        });
    });

    describe("event filtering", () => {
        test("should ignore events without iframeLifecycle property", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            const event = {
                someOtherEvent: "value",
            } as any;

            // Should not throw
            await expect(manager.handleEvent(event)).resolves.toBeUndefined();
        });

        test("should only process events with iframeLifecycle", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );
            const { changeIframeVisibility } = await import(
                "../../utils/iframeHelper"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
                targetOrigin: WALLET_ORIGIN,
            });

            // Event without iframeLifecycle
            await manager.handleEvent({ randomEvent: "show" } as any);

            // changeIframeVisibility should not be called
            expect(changeIframeVisibility).not.toHaveBeenCalled();

            // Event with iframeLifecycle
            await manager.handleEvent({ iframeLifecycle: "show" as const });

            // Now it should be called
            expect(changeIframeVisibility).toHaveBeenCalled();
        });
    });
});
