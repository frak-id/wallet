import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWebNotificationAdapter } from "./webAdapter";

const { putMock, deleteMock, hasAnyGetMock } = vi.hoisted(() => ({
    putMock: vi.fn(),
    deleteMock: vi.fn(),
    hasAnyGetMock: vi.fn(),
}));

vi.mock("../api/backendClient", () => ({
    authenticatedWalletApi: {
        notifications: {
            tokens: {
                put: putMock,
                delete: deleteMock,
                hasAny: {
                    get: hasAnyGetMock,
                },
            },
        },
    },
}));

describe.sequential("createWebNotificationAdapter", () => {
    const originalServiceWorker = globalThis.navigator.serviceWorker;
    const originalPushManager = globalThis.window.PushManager;
    const originalNotification = globalThis.window.Notification;
    const originalGlobalNotification = globalThis.Notification;
    const originalServiceWorkerRegistration =
        globalThis.ServiceWorkerRegistration;

    const mockSubscribe = vi.fn();
    const mockGetSubscription = vi.fn();
    const mockUnsubscribe = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        putMock.mockReset();
        deleteMock.mockReset();
        hasAnyGetMock.mockReset();
        mockSubscribe.mockReset();
        mockGetSubscription.mockReset();
        mockUnsubscribe.mockReset();

        const defaultSubscription = {
            toJSON: vi.fn().mockReturnValue({
                endpoint: "https://example.com/default",
                keys: {
                    p256dh: "default-p256",
                    auth: "default-auth",
                },
                expirationTime: null,
            }),
            unsubscribe: mockUnsubscribe,
        } as unknown as PushSubscription;

        putMock.mockResolvedValue(undefined);
        deleteMock.mockResolvedValue(undefined);
        hasAnyGetMock.mockResolvedValue({ data: false });
        mockSubscribe.mockResolvedValue(defaultSubscription);
        mockGetSubscription.mockResolvedValue(null);

        const ServiceWorkerRegistrationMock = () => undefined;
        Object.defineProperty(ServiceWorkerRegistrationMock, "prototype", {
            value: {
                showNotification: vi.fn(),
            },
            configurable: true,
        });

        Object.defineProperty(globalThis, "ServiceWorkerRegistration", {
            value: ServiceWorkerRegistrationMock,
            configurable: true,
        });

        Object.defineProperty(globalThis.window, "PushManager", {
            value: class PushManagerMock {},
            configurable: true,
        });

        Object.defineProperty(globalThis.window, "Notification", {
            value: {
                permission: "default",
                requestPermission: vi.fn().mockResolvedValue("granted"),
            },
            configurable: true,
        });
        Object.defineProperty(globalThis, "Notification", {
            value: globalThis.window.Notification,
            configurable: true,
        });

        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            value: {
                ready: Promise.resolve({
                    pushManager: {
                        subscribe: mockSubscribe,
                        getSubscription: mockGetSubscription,
                    },
                }),
                register: vi.fn().mockResolvedValue({
                    pushManager: {
                        getSubscription: mockGetSubscription,
                    },
                }),
            },
            configurable: true,
        });
    });

    afterEach(() => {
        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            value: originalServiceWorker,
            configurable: true,
        });
        Object.defineProperty(globalThis.window, "PushManager", {
            value: originalPushManager,
            configurable: true,
        });
        Object.defineProperty(globalThis.window, "Notification", {
            value: originalNotification,
            configurable: true,
        });
        Object.defineProperty(globalThis, "Notification", {
            value: originalGlobalNotification,
            configurable: true,
        });
        Object.defineProperty(globalThis, "ServiceWorkerRegistration", {
            value: originalServiceWorkerRegistration,
            configurable: true,
        });
    });

    it("should detect support from web notification APIs", () => {
        const adapter = createWebNotificationAdapter();

        expect(adapter.isSupported()).toBe(true);
    });

    it("should return current notification permission status", () => {
        const adapter = createWebNotificationAdapter();

        expect(adapter.getPermissionStatus()).toBe("default");
    });

    it("should request notification permission", async () => {
        const adapter = createWebNotificationAdapter();

        const result = await adapter.requestPermission();

        expect(window.Notification.requestPermission).toHaveBeenCalledOnce();
        expect(result).toBe("granted");
    });

    it("should subscribe and sync token to backend", async () => {
        const subscriptionJson = {
            endpoint: "https://example.com/endpoint",
            keys: {
                p256dh: "p256",
                auth: "auth",
            },
            expirationTime: 123,
        };
        const subscription = {
            toJSON: vi.fn().mockReturnValue(subscriptionJson),
            unsubscribe: mockUnsubscribe,
        } as unknown as PushSubscription;

        mockSubscribe.mockResolvedValue(subscription);

        const adapter = createWebNotificationAdapter();
        await adapter.subscribe();

        expect(mockSubscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: process.env.VAPID_PUBLIC_KEY,
        });
        expect(putMock).toHaveBeenCalledTimes(1);
        expect(putMock).toHaveBeenCalledWith({
            type: "web-push",
            subscription: {
                endpoint: "https://example.com/endpoint",
                keys: {
                    p256dh: "p256",
                    auth: "auth",
                },
                expirationTime: 123,
            },
        });
    });

    it("should unsubscribe current subscription and remove backend tokens", async () => {
        const subscription = {
            toJSON: vi.fn().mockReturnValue({
                endpoint: "https://example.com/endpoint",
                keys: {
                    p256dh: "p256",
                    auth: "auth",
                },
                expirationTime: null,
            }),
            unsubscribe: mockUnsubscribe,
        } as unknown as PushSubscription;

        mockSubscribe.mockResolvedValue(subscription);

        const adapter = createWebNotificationAdapter();
        await adapter.subscribe();
        await adapter.unsubscribe();

        expect(mockUnsubscribe).toHaveBeenCalledOnce();
        expect(deleteMock).toHaveBeenCalledOnce();
    });

    it("should check subscription status from backend", async () => {
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createWebNotificationAdapter();
        const result = await adapter.isSubscribed();

        expect(hasAnyGetMock).toHaveBeenCalledOnce();
        expect(result).toBe(true);
    });

    it("should initialize service worker and sync existing subscription", async () => {
        const existingSubscription = {
            toJSON: vi.fn().mockReturnValue({
                endpoint: "https://example.com/existing",
                keys: {
                    p256dh: "existing-p256",
                    auth: "existing-auth",
                },
                expirationTime: null,
            }),
            unsubscribe: mockUnsubscribe,
        } as unknown as PushSubscription;

        mockGetSubscription.mockResolvedValue(existingSubscription);

        const adapter = createWebNotificationAdapter();
        const result = await adapter.initialize();

        expect(
            globalThis.navigator.serviceWorker.register
        ).toHaveBeenCalledWith("/sw.js", {
            scope: "/",
            updateViaCache: "none",
        });
        expect(putMock).toHaveBeenCalledWith({
            type: "web-push",
            subscription: {
                endpoint: "https://example.com/existing",
                keys: {
                    p256dh: "existing-p256",
                    auth: "existing-auth",
                },
                expirationTime: undefined,
            },
        });
        expect(result).toEqual({ isSubscribed: true });
    });

    it("should return unsubscribed state on initialize when no existing subscription", async () => {
        mockGetSubscription.mockResolvedValue(null);

        const adapter = createWebNotificationAdapter();
        const result = await adapter.initialize();

        expect(result).toEqual({ isSubscribed: false });
        expect(putMock).not.toHaveBeenCalled();
    });

    it("should no-op when showing local notifications", async () => {
        const adapter = createWebNotificationAdapter();

        await expect(
            adapter.showLocalNotification({
                title: "title",
                body: "body",
            })
        ).resolves.toBeUndefined();
    });
});
