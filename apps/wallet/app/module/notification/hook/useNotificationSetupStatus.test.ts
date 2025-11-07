import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import * as NotificationContext from "@/module/notification/context/NotificationContext";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock the notification context
vi.mock("@/module/notification/context/NotificationContext", () => ({
    useNotificationContext: vi.fn(() => ({
        subscription: undefined,
        setSubscription: vi.fn(),
        clearSubscription: vi.fn(),
    })),
}));

describe("useNotificationSetupStatus", () => {
    // Use fixture for automatic browser API cleanup!
    beforeEach(({ mockNotificationContext }) => {
        vi.clearAllMocks();
        // Reset mock implementation using fixture
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue(
            mockNotificationContext
        );
    });

    test("should return not supported when required APIs are missing", () => {
        // No browser API mocking = unsupported environment
        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(false);
    });

    test("should detect browser notification support when APIs are available", ({
        mockBrowserAPIs,
    }) => {
        // Use fixture to setup browser APIs
        mockBrowserAPIs.mockNotificationAPI("default");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
    });

    test("should return notification permission status structure", ({
        mockBrowserAPIs,
    }) => {
        // Setup full browser API support
        mockBrowserAPIs.mockNotificationAPI("default");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        // The hook should have all required properties when supported
        expect(result.current).toHaveProperty("isSupported");
        expect(result.current.isSupported).toBe(true);
        expect(result.current).toHaveProperty("isNotificationAllowed");
        expect(result.current).toHaveProperty("askForNotificationPermission");
        expect(result.current).toHaveProperty("subscription");
    });

    test("should provide askForNotificationPermission callback when supported", ({
        mockBrowserAPIs,
    }) => {
        // Setup full browser API support
        mockBrowserAPIs.mockNotificationAPI("default");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
        expect(typeof result.current.askForNotificationPermission).toBe(
            "function"
        );
    });

    test("should integrate with notification context for subscription", ({
        mockBrowserAPIs,
    }) => {
        // Setup full browser API support
        mockBrowserAPIs.mockNotificationAPI("default");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
        expect(result.current).toHaveProperty("subscription");
        expect(result.current.subscription).toBeUndefined(); // From fixture default
    });

    test("should call Notification.requestPermission when askForNotificationPermission is invoked", async ({
        mockBrowserAPIs,
    }) => {
        // Setup browser APIs with fixture - so much cleaner!
        mockBrowserAPIs.mockNotificationAPI("default");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);

        // Mock the requestPermission spy after setup
        const mockRequestPermission = vi.fn().mockResolvedValue("granted");
        global.Notification.requestPermission = mockRequestPermission;

        await result.current.askForNotificationPermission?.();
        expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    });

    test("should handle errors when requesting notification permission fails", async ({
        mockBrowserAPIs,
    }) => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const mockError = new Error("Permission denied");

        // Setup browser APIs with fixture
        mockBrowserAPIs.mockNotificationAPI("default");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);

        // Mock requestPermission to reject
        const mockRequestPermission = vi.fn().mockRejectedValue(mockError);
        global.Notification.requestPermission = mockRequestPermission;

        await result.current.askForNotificationPermission?.();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Failed to request notification permission: ",
            mockError
        );

        consoleErrorSpy.mockRestore();
    });

    test("should detect granted notification permission", ({
        mockBrowserAPIs,
    }) => {
        // Setup with granted permission - fixture makes this trivial!
        mockBrowserAPIs.mockNotificationAPI("granted");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
        expect(result.current.isNotificationAllowed).toBe(true);
    });

    test("should detect denied notification permission", ({
        mockBrowserAPIs,
    }) => {
        // Setup with denied permission - fixture makes this trivial!
        mockBrowserAPIs.mockNotificationAPI("denied");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
        expect(result.current.isNotificationAllowed).toBe(false);
    });

    test("should include subscription from context when available", ({
        mockBrowserAPIs,
    }) => {
        const mockSubscription = {
            endpoint: "https://example.com/push",
            keys: {
                p256dh: "key1",
                auth: "key2",
            },
        } as unknown as PushSubscription;

        // Mock notification context with subscription
        vi.mocked(NotificationContext.useNotificationContext).mockReturnValue({
            subscription: mockSubscription,
            setSubscription: vi.fn(),
            clearSubscription: vi.fn(),
        });

        // Setup browser APIs with fixture
        mockBrowserAPIs.mockNotificationAPI("granted");
        mockBrowserAPIs.mockServiceWorkerAPI();
        mockBrowserAPIs.mockPushManagerAPI();

        const { result } = renderHook(() => useNotificationSetupStatus());

        expect(result.current.isSupported).toBe(true);
        expect(result.current.subscription).toEqual(mockSubscription);
    });
});
