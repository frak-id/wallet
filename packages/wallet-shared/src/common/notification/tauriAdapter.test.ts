import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriNotificationAdapter } from "./tauriAdapter";

const {
    sendNotificationMock,
    isPermissionGrantedMock,
    requestPermissionMock,
    createChannelMock,
    registerForPushNotificationsMock,
    unregisterForPushNotificationsMock,
} = vi.hoisted(() => ({
    sendNotificationMock: vi.fn(),
    isPermissionGrantedMock: vi.fn(),
    requestPermissionMock: vi.fn(),
    createChannelMock: vi.fn(),
    registerForPushNotificationsMock: vi.fn(),
    unregisterForPushNotificationsMock: vi.fn(),
}));

vi.mock("@choochmeque/tauri-plugin-notifications-api", () => ({
    sendNotification: sendNotificationMock,
    isPermissionGranted: isPermissionGrantedMock,
    requestPermission: requestPermissionMock,
    createChannel: createChannelMock,
    registerForPushNotifications: registerForPushNotificationsMock,
    unregisterForPushNotifications: unregisterForPushNotificationsMock,
}));

const { isAndroidMock, isIOSMock } = vi.hoisted(() => ({
    isAndroidMock: vi.fn(),
    isIOSMock: vi.fn(),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isAndroid: isAndroidMock,
    isIOS: isIOSMock,
    isTauri: vi.fn().mockReturnValue(true),
}));

const { addMock } = vi.hoisted(() => ({
    addMock: vi.fn(),
}));

vi.mock("../storage/notifications", () => ({
    notificationStorage: {
        add: addMock,
    },
}));

const { addPluginListenerMock } = vi.hoisted(() => ({
    addPluginListenerMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    addPluginListener: addPluginListenerMock,
}));

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

describe.sequential("createTauriNotificationAdapter", () => {
    const mockUUID = "test-uuid-1234-5678";

    beforeEach(() => {
        sendNotificationMock.mockReset();
        isPermissionGrantedMock.mockReset();
        requestPermissionMock.mockReset();
        createChannelMock.mockReset();
        registerForPushNotificationsMock.mockReset();
        unregisterForPushNotificationsMock.mockReset();
        isAndroidMock.mockReset();
        isIOSMock.mockReset();
        addMock.mockReset();
        addPluginListenerMock.mockReset();
        putMock.mockReset();
        deleteMock.mockReset();
        hasAnyGetMock.mockReset();

        // Default: Android context (most existing tests assume non-iOS)
        isAndroidMock.mockReturnValue(true);
        isIOSMock.mockReturnValue(false);

        // Default mock return values
        registerForPushNotificationsMock.mockResolvedValue("mock-fcm-token");
        unregisterForPushNotificationsMock.mockResolvedValue(undefined);
        addPluginListenerMock.mockResolvedValue(undefined);
        putMock.mockResolvedValue(undefined);
        deleteMock.mockResolvedValue(undefined);
        hasAnyGetMock.mockResolvedValue({ data: false });

        vi.stubGlobal("crypto", {
            randomUUID: vi.fn().mockReturnValue(mockUUID),
        });

        // Clean up iOS FCM token global set by native Swift code
        delete window.__frakFcmToken;
    });

    it("should return true for isSupported", () => {
        const adapter = createTauriNotificationAdapter();

        expect(adapter.isSupported()).toBe(true);
    });

    it("should return 'default' for getPermissionStatus initially", () => {
        const adapter = createTauriNotificationAdapter();

        expect(adapter.getPermissionStatus()).toBe("default");
    });

    it("should return 'granted' for getPermissionStatus after initialize when permission is granted", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(adapter.getPermissionStatus()).toBe("granted");
    });

    it("should call plugin requestPermission and return 'granted'", async () => {
        requestPermissionMock.mockResolvedValue("granted");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionMock).toHaveBeenCalledOnce();
        expect(result).toBe("granted");
    });

    it("should call plugin requestPermission and return 'denied'", async () => {
        requestPermissionMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionMock).toHaveBeenCalledOnce();
        expect(result).toBe("denied");
    });

    it("should call requestPermission internally when subscribing", async () => {
        requestPermissionMock.mockResolvedValue("granted");

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        expect(requestPermissionMock).toHaveBeenCalledOnce();
    });

    it("should not throw when unsubscribing (no-op)", async () => {
        const adapter = createTauriNotificationAdapter();

        await expect(adapter.unsubscribe()).resolves.toBeUndefined();
    });

    it("should return false for isSubscribed initially", async () => {
        const adapter = createTauriNotificationAdapter();

        const result = await adapter.isSubscribed();

        expect(result).toBe(false);
    });

    it("should return true for isSubscribed after permission granted", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();
        const result = await adapter.isSubscribed();

        expect(result).toBe(true);
    });

    it("should check permission and create Android channel when isAndroid is true", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(true);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(isPermissionGrantedMock).toHaveBeenCalledOnce();
        expect(createChannelMock).toHaveBeenCalledWith({
            id: "default",
            name: "Frak Wallet",
            importance: 4,
        });
    });

    it("should not create channel when isAndroid is false", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(isPermissionGrantedMock).toHaveBeenCalledOnce();
        expect(createChannelMock).not.toHaveBeenCalled();
    });

    it("should return isSubscribed true when permission granted on initialize", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initialize();

        expect(result).toEqual({ isSubscribed: true });
    });

    it("should return isSubscribed false when permission denied on initialize", async () => {
        isPermissionGrantedMock.mockResolvedValue(false);
        isAndroidMock.mockReturnValue(false);

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initialize();

        expect(result).toEqual({ isSubscribed: false });
    });

    it("should call sendNotification with mapped payload", async () => {
        const adapter = createTauriNotificationAdapter();

        await adapter.showLocalNotification({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
        });

        expect(sendNotificationMock).toHaveBeenCalledWith({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
        });
    });

    it("should call notificationStorage.add with correct NotificationModel shape", async () => {
        const now = 1700000000000;
        vi.spyOn(Date, "now").mockReturnValue(now);

        const adapter = createTauriNotificationAdapter();

        await adapter.showLocalNotification({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
            data: { url: "https://example.com" },
        });

        expect(addMock).toHaveBeenCalledWith({
            id: mockUUID,
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
            data: { url: "https://example.com" },
            timestamp: now,
        });
    });

    // --- FCM push flow tests ---

    it("should subscribe: register for push notifications and sync token to backend", async () => {
        requestPermissionMock.mockResolvedValue("granted");
        registerForPushNotificationsMock.mockResolvedValue("mock-fcm-token");

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        // Listener must be set up before registration to avoid missing events
        const listenerCallOrder =
            addPluginListenerMock.mock.invocationCallOrder[0];
        const registerCallOrder =
            registerForPushNotificationsMock.mock.invocationCallOrder[0];
        expect(listenerCallOrder).toBeLessThan(registerCallOrder);

        expect(registerForPushNotificationsMock).toHaveBeenCalledOnce();
        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "mock-fcm-token",
        });
    });

    it("should subscribe: handle registerForPushNotifications failure gracefully", async () => {
        requestPermissionMock.mockResolvedValue("granted");
        registerForPushNotificationsMock.mockRejectedValue(
            new Error("FCM registration failed")
        );

        const adapter = createTauriNotificationAdapter();

        // subscribe should NOT throw — registerForPushNotifications failure
        // is caught (e.g. iOS simulator has no APNs transport)
        await expect(adapter.subscribe()).resolves.toBeUndefined();
        expect(putMock).not.toHaveBeenCalled();
    });

    it("should subscribe: surface backend sync failure to caller", async () => {
        requestPermissionMock.mockResolvedValue("granted");
        registerForPushNotificationsMock.mockResolvedValue("mock-fcm-token");
        putMock.mockRejectedValue(new Error("Backend sync failed"));

        const adapter = createTauriNotificationAdapter();

        await expect(adapter.subscribe()).rejects.toThrow(
            "Backend sync failed"
        );
    });

    it("should unsubscribe: call unregisterForPushNotifications and delete backend token", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.unsubscribe();

        expect(unregisterForPushNotificationsMock).toHaveBeenCalledOnce();
        expect(deleteMock).toHaveBeenCalledOnce();
    });

    it("should isSubscribed: check backend and return true", async () => {
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.isSubscribed();

        expect(hasAnyGetMock).toHaveBeenCalledOnce();
        expect(result).toBe(true);
    });

    it("should isSubscribed: return false on backend error", async () => {
        hasAnyGetMock.mockRejectedValue(new Error("Backend error"));

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.isSubscribed();

        expect(result).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
            "Failed to fetch push subscription status",
            expect.any(Error)
        );

        warnSpy.mockRestore();
    });

    it("should initialize: set up token refresh listener when permission granted (Android)", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(true);
        isIOSMock.mockReturnValue(false);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(addPluginListenerMock).toHaveBeenCalledWith(
            "notifications",
            "push-token",
            expect.any(Function)
        );
    });

    it("should initialize: set up FCM token refresh listener when permission granted (iOS)", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);
        isIOSMock.mockReturnValue(true);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const addEventListenerSpy = vi.spyOn(window, "addEventListener");

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(addEventListenerSpy).toHaveBeenCalledWith(
            "frak:fcm-token",
            expect.any(Function)
        );

        addEventListenerSpy.mockRestore();
    });

    it("should initialize: token refresh event re-syncs to backend (Android)", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(true);
        isIOSMock.mockReturnValue(false);
        hasAnyGetMock.mockResolvedValue({ data: true });

        // Capture the callback passed to addPluginListener
        let capturedCallback: ((event: { token: string }) => void) | undefined;
        addPluginListenerMock.mockImplementation(
            (
                _plugin: string,
                _event: string,
                callback: (event: { token: string }) => void
            ) => {
                capturedCallback = callback;
                return Promise.resolve(undefined);
            }
        );

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(capturedCallback).toBeDefined();

        // Trigger the token refresh callback
        capturedCallback?.({ token: "refreshed-token" });

        // Wait for the async syncTokenToBackend to complete
        await vi.waitFor(() => {
            expect(putMock).toHaveBeenCalledWith({
                type: "fcm",
                token: "refreshed-token",
            });
        });
    });

    it("should initialize: token refresh event re-syncs to backend (iOS)", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);
        isIOSMock.mockReturnValue(true);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        // Simulate native FirebaseManager.swift emitting a refreshed FCM token
        window.dispatchEvent(
            new CustomEvent("frak:fcm-token", {
                detail: { token: "refreshed-ios-token" },
            })
        );

        // Wait for the async syncTokenToBackend to complete
        await vi.waitFor(() => {
            expect(putMock).toHaveBeenCalledWith({
                type: "fcm",
                token: "refreshed-ios-token",
            });
        });
    });

    it("should initialize: NOT set up listener when permission denied", async () => {
        isPermissionGrantedMock.mockResolvedValue(false);
        isAndroidMock.mockReturnValue(false);
        isIOSMock.mockReturnValue(false);

        const addEventListenerSpy = vi.spyOn(window, "addEventListener");

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(addPluginListenerMock).not.toHaveBeenCalled();
        expect(addEventListenerSpy).not.toHaveBeenCalledWith(
            "frak:fcm-token",
            expect.any(Function)
        );

        addEventListenerSpy.mockRestore();
    });

    // --- iOS FCM token exchange tests ---

    it("should subscribe on iOS: read FCM token from window global and sync to backend", async () => {
        isAndroidMock.mockReturnValue(false);
        isIOSMock.mockReturnValue(true);
        requestPermissionMock.mockResolvedValue("granted");
        registerForPushNotificationsMock.mockResolvedValue("raw-apns-hex");
        // Simulate native FirebaseManager.swift having already set the token
        window.__frakFcmToken = "ios-fcm-token";

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        expect(registerForPushNotificationsMock).toHaveBeenCalledOnce();
        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "ios-fcm-token",
        });
    });

    it("should subscribe on iOS: wait for FCM token event when not immediately available", async () => {
        isAndroidMock.mockReturnValue(false);
        isIOSMock.mockReturnValue(true);
        requestPermissionMock.mockResolvedValue("granted");
        registerForPushNotificationsMock.mockResolvedValue("raw-apns-hex");
        // window.__frakFcmToken is NOT set — token arrives via event

        const adapter = createTauriNotificationAdapter();
        const subscribePromise = adapter.subscribe();

        // Simulate native Firebase delivering the token after a delay
        setTimeout(() => {
            window.dispatchEvent(
                new CustomEvent("frak:fcm-token", {
                    detail: { token: "delayed-ios-fcm-token" },
                })
            );
        }, 50);

        await subscribePromise;

        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "delayed-ios-fcm-token",
        });
    });

    it("should subscribe on iOS: throw when FCM token not received within timeout", async () => {
        vi.useFakeTimers();

        isAndroidMock.mockReturnValue(false);
        isIOSMock.mockReturnValue(true);
        requestPermissionMock.mockResolvedValue("granted");
        registerForPushNotificationsMock.mockResolvedValue("raw-apns-hex");
        // window.__frakFcmToken is NOT set, no event dispatched → timeout

        const adapter = createTauriNotificationAdapter();
        const subscribePromise = adapter.subscribe();

        // Set up the rejection expectation BEFORE advancing time
        // so the rejection doesn't fire as "unhandled"
        const rejectAssertion = expect(subscribePromise).rejects.toThrow(
            "FCM token not received within timeout"
        );

        // Advance past the 10s timeout
        await vi.advanceTimersByTimeAsync(10_000);

        await rejectAssertion;
        expect(putMock).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("should subscribe on Android: use token from registerForPushNotifications directly", async () => {
        isAndroidMock.mockReturnValue(true);
        isIOSMock.mockReturnValue(false);
        requestPermissionMock.mockResolvedValue("granted");
        registerForPushNotificationsMock.mockResolvedValue("android-fcm-token");

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "android-fcm-token",
        });
    });
});
