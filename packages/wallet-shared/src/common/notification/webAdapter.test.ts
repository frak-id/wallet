import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWebNotificationAdapter } from "./webAdapter";

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

    it("should return current notification permission status when getPermissionStatus called", async () => {
        const adapter = createWebNotificationAdapter();

        const result = await adapter.getPermissionStatus();

        expect(result).toBe("default");
    });

    it("should request notification permission when requestPermission called", async () => {
        const adapter = createWebNotificationAdapter();

        const result = await adapter.requestPermission();

        expect(window.Notification.requestPermission).toHaveBeenCalledOnce();
        expect(result).toBe("granted");
    });

    it("should register service worker when initPromise awaited", async () => {
        const adapter = createWebNotificationAdapter();

        await adapter.initPromise;

        expect(
            globalThis.navigator.serviceWorker.register
        ).toHaveBeenCalledWith("/sw.js", {
            scope: "/",
            updateViaCache: "none",
        });
    });

    it("should return null from getToken when no existing subscription", async () => {
        mockGetSubscription.mockResolvedValue(null);

        const adapter = createWebNotificationAdapter();

        const result = await adapter.getToken();

        expect(result).toBeNull();
    });

    it("should return PushTokenPayload from getToken when existing subscription found", async () => {
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

        const result = await adapter.getToken();

        expect(result).toEqual({
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
    });

    it("should return PushTokenPayload when subscribing", async () => {
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
        const result = await adapter.subscribe();

        expect(mockSubscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: process.env.VAPID_PUBLIC_KEY,
        });
        expect(result).toEqual({
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

    it("should unsubscribe current subscription when unsubscribe called", async () => {
        const subscriptionUnsubscribe = vi.fn();
        const subscription = {
            toJSON: vi.fn().mockReturnValue({
                endpoint: "https://example.com/endpoint",
                keys: {
                    p256dh: "p256",
                    auth: "auth",
                },
                expirationTime: null,
            }),
            unsubscribe: subscriptionUnsubscribe,
        } as unknown as PushSubscription;

        mockSubscribe.mockResolvedValue(subscription);
        mockGetSubscription.mockResolvedValue(subscription);

        const adapter = createWebNotificationAdapter();
        await adapter.subscribe();
        await adapter.unsubscribe();

        expect(subscriptionUnsubscribe).toHaveBeenCalledOnce();
    });
});
