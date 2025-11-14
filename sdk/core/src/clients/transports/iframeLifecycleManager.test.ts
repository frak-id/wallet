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
        test("should post handshake-response with token", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockPostMessage = vi.fn();
            const mockIframe = {
                contentWindow: {
                    postMessage: mockPostMessage,
                },
            } as any;

            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
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
                    },
                },
                "*"
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
                contentWindow: {
                    postMessage: mockPostMessage,
                },
            } as any;

            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
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
                "*"
            );
        });
    });

    describe("redirect event", () => {
        test("should redirect with appended current URL", async () => {
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
    });

    describe("event filtering", () => {
        test("should ignore events without iframeLifecycle property", async () => {
            const { createIFrameLifecycleManager } = await import(
                "./iframeLifecycleManager"
            );

            const mockIframe = document.createElement("iframe");
            const manager = createIFrameLifecycleManager({
                iframe: mockIframe,
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
