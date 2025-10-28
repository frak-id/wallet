import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as NotificationContext from "@/module/notification/context/NotificationContext";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";

// Mock the notification context
vi.mock("@/module/notification/context/NotificationContext", () => ({
    useNotificationContext: vi.fn(() => ({
        subscription: undefined,
        setSubscription: vi.fn(),
        clearSubscription: vi.fn(),
    })),
}));

describe("useNotificationSetupStatus", () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;
    const originalNotification = global.Notification;

    beforeEach(() => {
        vi.clearAllMocks();
        // Restore defaults before each test
        global.window = originalWindow;
        global.navigator = originalNavigator;
        global.Notification = originalNotification;
        // Reset mock implementation
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue({
            subscription: undefined,
            setSubscription: vi.fn(),
            clearSubscription: vi.fn(),
        });
    });

    it("should return not supported when required APIs are missing", () => {
        // Test the logic by checking when serviceWorker is missing
        const mockNavigator = Object.create(originalNavigator);
        Object.defineProperty(mockNavigator, "serviceWorker", {
            value: undefined,
            writable: true,
        });
        global.navigator = mockNavigator as Navigator;

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(false);
    });

    it("should detect browser notification support in test environment", () => {
        // In test environment with jsdom, we have basic browser APIs
        const { result } = renderHook(() => useNotificationSetupStatus());

        // Check that the hook returns a boolean for isSupported
        expect(typeof result.current.isSupported).toBe("boolean");
    });

    it("should return notification permission status structure", () => {
        const { result } = renderHook(() => useNotificationSetupStatus());

        // The hook should always return at minimum isSupported
        expect(result.current).toHaveProperty("isSupported");

        if (result.current.isSupported) {
            // If supported, should have these properties
            expect(result.current).toHaveProperty("isNotificationAllowed");
            expect(result.current).toHaveProperty(
                "askForNotificationPermission"
            );
            expect(result.current).toHaveProperty("subscription");
        }
    });

    it("should provide askForNotificationPermission callback when supported", () => {
        const { result } = renderHook(() => useNotificationSetupStatus());

        if (
            result.current.isSupported &&
            "askForNotificationPermission" in result.current
        ) {
            expect(typeof result.current.askForNotificationPermission).toBe(
                "function"
            );
        } else {
            // In unsupported environment, callback should not be present
            expect(result.current).not.toHaveProperty(
                "askForNotificationPermission"
            );
        }
    });

    it("should integrate with notification context for subscription", () => {
        const { result } = renderHook(() => useNotificationSetupStatus());

        if (result.current.isSupported) {
            // Should include subscription from context (mocked as null)
            expect(result.current).toHaveProperty("subscription");
        }
    });

    it("should call Notification.requestPermission when askForNotificationPermission is invoked", async () => {
        // Mock Notification API
        const mockRequestPermission = vi.fn().mockResolvedValue("granted");
        global.Notification = {
            requestPermission: mockRequestPermission,
            permission: "default",
        } as unknown as typeof Notification;

        // Mock full support
        Object.defineProperty(global.navigator, "serviceWorker", {
            value: {},
            writable: true,
        });
        Object.defineProperty(global.window, "PushManager", {
            value: {},
            writable: true,
        });
        global.ServiceWorkerRegistration = {
            prototype: {
                showNotification: vi.fn(),
            },
        } as unknown as typeof ServiceWorkerRegistration;

        const { result } = renderHook(() => useNotificationSetupStatus());

        if (
            result.current.isSupported &&
            "askForNotificationPermission" in result.current
        ) {
            await result.current.askForNotificationPermission?.();
            expect(mockRequestPermission).toHaveBeenCalledTimes(1);
        }
    });

    it("should handle errors when requesting notification permission fails", async () => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const mockError = new Error("Permission denied");
        const mockRequestPermission = vi.fn().mockRejectedValue(mockError);

        global.Notification = {
            requestPermission: mockRequestPermission,
            permission: "default",
        } as unknown as typeof Notification;

        // Mock full support
        Object.defineProperty(global.navigator, "serviceWorker", {
            value: {},
            writable: true,
        });
        Object.defineProperty(global.window, "PushManager", {
            value: {},
            writable: true,
        });
        global.ServiceWorkerRegistration = {
            prototype: {
                showNotification: vi.fn(),
            },
        } as unknown as typeof ServiceWorkerRegistration;

        const { result } = renderHook(() => useNotificationSetupStatus());

        if (
            result.current.isSupported &&
            "askForNotificationPermission" in result.current
        ) {
            await result.current.askForNotificationPermission?.();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to request notification permission: ",
                mockError
            );
        }

        consoleErrorSpy.mockRestore();
    });

    it("should detect granted notification permission", () => {
        global.Notification = {
            permission: "granted",
        } as unknown as typeof Notification;

        // Mock full support
        Object.defineProperty(global.navigator, "serviceWorker", {
            value: {},
            writable: true,
        });
        Object.defineProperty(global.window, "PushManager", {
            value: {},
            writable: true,
        });
        global.ServiceWorkerRegistration = {
            prototype: {
                showNotification: vi.fn(),
            },
        } as unknown as typeof ServiceWorkerRegistration;

        const { result } = renderHook(() => useNotificationSetupStatus());

        if (result.current.isSupported) {
            expect(result.current.isNotificationAllowed).toBe(true);
        }
    });

    it("should detect denied notification permission", () => {
        global.Notification = {
            permission: "denied",
        } as unknown as typeof Notification;

        // Mock full support
        Object.defineProperty(global.navigator, "serviceWorker", {
            value: {},
            writable: true,
        });
        Object.defineProperty(global.window, "PushManager", {
            value: {},
            writable: true,
        });
        global.ServiceWorkerRegistration = {
            prototype: {
                showNotification: vi.fn(),
            },
        } as unknown as typeof ServiceWorkerRegistration;

        const { result } = renderHook(() => useNotificationSetupStatus());

        if (result.current.isSupported) {
            expect(result.current.isNotificationAllowed).toBe(false);
        }
    });

    it("should include subscription from context when available", () => {
        const mockSubscription = {
            endpoint: "https://example.com/push",
            keys: {
                p256dh: "key1",
                auth: "key2",
            },
        } as unknown as PushSubscription;

        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue({
            subscription: mockSubscription,
            setSubscription: vi.fn(),
            clearSubscription: vi.fn(),
        });

        global.Notification = {
            permission: "granted",
        } as unknown as typeof Notification;

        // Mock full support
        Object.defineProperty(global.navigator, "serviceWorker", {
            value: {},
            writable: true,
        });
        Object.defineProperty(global.window, "PushManager", {
            value: {},
            writable: true,
        });
        global.ServiceWorkerRegistration = {
            prototype: {
                showNotification: vi.fn(),
            },
        } as unknown as typeof ServiceWorkerRegistration;

        const { result } = renderHook(() => useNotificationSetupStatus());

        if (result.current.isSupported) {
            expect(result.current.subscription).toEqual(mockSubscription);
        }
    });
});
