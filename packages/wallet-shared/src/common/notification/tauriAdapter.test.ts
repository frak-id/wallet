import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriNotificationAdapter } from "./tauriAdapter";

const {
    getTokenMock,
    requestPermissionsMock,
    checkPermissionsMock,
    registerMock,
    deleteTokenMock,
    createChannelMock,
    sendNotificationMock,
    onTokenRefreshMock,
} = vi.hoisted(() => ({
    getTokenMock: vi.fn(),
    requestPermissionsMock: vi.fn(),
    checkPermissionsMock: vi.fn(),
    registerMock: vi.fn(),
    deleteTokenMock: vi.fn(),
    createChannelMock: vi.fn(),
    sendNotificationMock: vi.fn(),
    onTokenRefreshMock: vi.fn(),
}));

let capturedTokenRefreshHandler:
    | ((event: { token: string }) => void)
    | undefined;

vi.mock("tauri-plugin-fcm", () => ({
    getToken: getTokenMock,
    requestPermissions: requestPermissionsMock,
    checkPermissions: checkPermissionsMock,
    register: registerMock,
    deleteToken: deleteTokenMock,
    createChannel: createChannelMock,
    sendNotification: sendNotificationMock,
    onTokenRefresh: onTokenRefreshMock,
}));

const { addMock } = vi.hoisted(() => ({
    addMock: vi.fn(),
}));

vi.mock("../storage/notifications", () => ({
    notificationStorage: {
        add: addMock,
    },
}));

const { idbGetMock, idbSetMock } = vi.hoisted(() => ({
    idbGetMock: vi.fn(),
    idbSetMock: vi.fn(),
}));

vi.mock("idb-keyval", () => ({
    createStore: vi.fn(() => ({})),
    get: idbGetMock,
    set: idbSetMock,
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
        getTokenMock.mockReset();
        requestPermissionsMock.mockReset();
        checkPermissionsMock.mockReset();
        registerMock.mockReset();
        deleteTokenMock.mockReset();
        createChannelMock.mockReset();
        sendNotificationMock.mockReset();
        onTokenRefreshMock.mockReset();
        addMock.mockReset();
        putMock.mockReset();
        deleteMock.mockReset();
        hasAnyGetMock.mockReset();
        idbGetMock.mockReset();
        idbSetMock.mockReset();
        capturedTokenRefreshHandler = undefined;

        // Default mock return values
        getTokenMock.mockResolvedValue({ token: "mock-fcm-token" });
        requestPermissionsMock.mockResolvedValue("granted");
        checkPermissionsMock.mockResolvedValue("granted");
        registerMock.mockResolvedValue(undefined);
        deleteTokenMock.mockResolvedValue(undefined);
        createChannelMock.mockResolvedValue(undefined);
        sendNotificationMock.mockResolvedValue(undefined);
        onTokenRefreshMock.mockImplementation(
            (handler: (event: { token: string }) => void) => {
                capturedTokenRefreshHandler = handler;
                return Promise.resolve({ unregister: vi.fn() });
            }
        );
        putMock.mockResolvedValue(undefined);
        deleteMock.mockResolvedValue(undefined);
        hasAnyGetMock.mockResolvedValue({ data: false });
        // Default: user has not opted out
        idbGetMock.mockResolvedValue(false);
        idbSetMock.mockResolvedValue(undefined);

        vi.stubGlobal("crypto", {
            randomUUID: vi.fn().mockReturnValue(mockUUID),
        });
    });

    it("should return true for isSupported", () => {
        const adapter = createTauriNotificationAdapter();

        expect(adapter.isSupported()).toBe(true);
    });

    it("should return 'default' for getPermissionStatus initially", () => {
        const adapter = createTauriNotificationAdapter();

        expect(adapter.getPermissionStatus()).toBe("default");
    });

    it("should return 'granted' for requestPermission when plugin returns 'granted'", async () => {
        requestPermissionsMock.mockResolvedValue("granted");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionsMock).toHaveBeenCalledOnce();
        expect(result).toBe("granted");
    });

    it("should return 'denied' for requestPermission when plugin returns 'denied'", async () => {
        requestPermissionsMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionsMock).toHaveBeenCalledOnce();
        expect(result).toBe("denied");
    });

    it("should map 'prompt' to 'default' for requestPermission", async () => {
        requestPermissionsMock.mockResolvedValue("prompt");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(result).toBe("default");
    });

    it("should subscribe: call requestPermissions, register, getToken, and sync to backend", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "new-fcm-token" });

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        expect(requestPermissionsMock).toHaveBeenCalledOnce();
        expect(registerMock).toHaveBeenCalledOnce();
        expect(getTokenMock).toHaveBeenCalledOnce();
        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "new-fcm-token",
        });
    });

    it("should subscribe: clear opt-out only after backend sync succeeds", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "new-fcm-token" });

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        // Opt-out cleared with false after full success
        expect(idbSetMock).toHaveBeenCalledWith(
            "push-opt-out",
            false,
            expect.anything()
        );
        // Backend sync must happen before opt-out clear
        const putOrder = putMock.mock.invocationCallOrder[0];
        const setOrder = idbSetMock.mock.invocationCallOrder[0];
        expect(putOrder).toBeLessThan(setOrder);
    });

    it("should subscribe: keep opt-out flag set when backend sync fails", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "new-fcm-token" });
        putMock.mockRejectedValue(new Error("Backend sync failed"));

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "Backend sync failed"
        );

        // setPushOptOut(false) should NOT have been called
        expect(idbSetMock).not.toHaveBeenCalled();
    });

    it("should subscribe: set up onTokenRefresh listener BEFORE register", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "new-fcm-token" });

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        // onTokenRefresh must be called before register
        const listenerCallOrder =
            onTokenRefreshMock.mock.invocationCallOrder[0];
        const registerCallOrder = registerMock.mock.invocationCallOrder[0];
        expect(listenerCallOrder).toBeLessThan(registerCallOrder);
    });

    it("should subscribe: wait for token via onTokenRefresh when getToken rejects (cold start)", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockRejectedValue(new Error("FCM token not available"));

        const adapter = createTauriNotificationAdapter();
        const subscribePromise = adapter.subscribe();

        // Let subscribe() reach the pending-delivery await
        await new Promise((r) => setTimeout(r, 0));

        // FCM delivers the token via onTokenRefresh
        capturedTokenRefreshHandler?.({ token: "late-delivered-token" });

        await subscribePromise;

        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "late-delivered-token",
        });
    });

    it("should subscribe: propagate real APNs error from getToken instead of timing out", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockRejectedValue(new Error("APNs entitlement missing"));

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "APNs entitlement missing"
        );

        // Should fail fast — no backend sync attempted
        expect(putMock).not.toHaveBeenCalled();
    });

    it("should subscribe: reject when token delivery times out", async () => {
        vi.useFakeTimers();
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockRejectedValue(new Error("FCM token not available"));

        const adapter = createTauriNotificationAdapter();
        const subscribePromise = adapter.subscribe();

        // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
        const assertion = expect(subscribePromise).rejects.toThrow(
            "FCM token delivery timed out"
        );

        // Advance past the 10s timeout
        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;
        expect(putMock).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("should subscribe: use buffered token when refresh arrives before getToken", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockRejectedValue(new Error("FCM token not available"));

        // register() triggers a token-refresh before getToken runs
        registerMock.mockImplementation(async () => {
            capturedTokenRefreshHandler?.({ token: "early-token" });
        });

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        // subscribe() should use the buffered token (handler also synced
        // fire-and-forget, so putMock is called twice with the same token)
        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "early-token",
        });
    });

    it("should subscribe: propagate backend sync failure to caller", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "new-fcm-token" });
        putMock.mockRejectedValue(new Error("Backend sync failed"));

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "Backend sync failed"
        );
    });

    it("should subscribe: throw when requestPermissions returns denied", async () => {
        requestPermissionsMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "Notification permission denied"
        );

        expect(registerMock).not.toHaveBeenCalled();
        expect(getTokenMock).not.toHaveBeenCalled();
        expect(putMock).not.toHaveBeenCalled();
    });

    it("should subscribe: throw when register fails", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        registerMock.mockRejectedValue(new Error("FCM registration failed"));

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "FCM registration failed"
        );

        expect(putMock).not.toHaveBeenCalled();
    });

    it("should subscribe: warn and continue when listener setup fails", async () => {
        requestPermissionsMock.mockResolvedValue("granted");
        onTokenRefreshMock.mockRejectedValue(
            new Error("registerListener not allowed")
        );
        getTokenMock.mockResolvedValue({ token: "direct-token" });

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("FCM token refresh listener unavailable"),
            expect.any(Error)
        );
        warnSpy.mockRestore();

        expect(putMock).toHaveBeenCalledWith({
            type: "fcm",
            token: "direct-token",
        });
    });

    it("should requestPermission: propagate plugin errors", async () => {
        requestPermissionsMock.mockRejectedValue(
            new Error("Plugin not available")
        );

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.requestPermission()).rejects.toThrow(
            "Plugin not available"
        );
    });

    it("should unsubscribe: call deleteToken and backend DELETE", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.unsubscribe();

        expect(deleteTokenMock).toHaveBeenCalledOnce();
        expect(deleteMock).toHaveBeenCalledOnce();
    });

    it("should unsubscribe: clean up token refresh listener", async () => {
        const unregisterMock = vi.fn().mockResolvedValue(undefined);
        onTokenRefreshMock.mockImplementation(
            (handler: (event: { token: string }) => void) => {
                capturedTokenRefreshHandler = handler;
                return Promise.resolve({ unregister: unregisterMock });
            }
        );

        const adapter = createTauriNotificationAdapter();

        // Subscribe first to set up the listener
        requestPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "fcm-token" });
        await adapter.subscribe();
        expect(onTokenRefreshMock).toHaveBeenCalledOnce();

        // Unsubscribe should clean up the listener
        await adapter.unsubscribe();
        expect(unregisterMock).toHaveBeenCalledOnce();

        // Re-subscribing should set up a fresh listener
        onTokenRefreshMock.mockClear();
        await adapter.subscribe();
        expect(onTokenRefreshMock).toHaveBeenCalledOnce();
    });

    it("should isSubscribed: check backend and return true", async () => {
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.isSubscribed();

        expect(hasAnyGetMock).toHaveBeenCalledOnce();
        expect(result).toBe(true);
    });

    it("should isSubscribed: return false when user explicitly opted out", async () => {
        idbGetMock.mockResolvedValue(true);
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.isSubscribed();

        expect(result).toBe(false);
        expect(hasAnyGetMock).not.toHaveBeenCalled();
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

    it("should initialize: call checkPermissions and return subscription status", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initialize();

        expect(checkPermissionsMock).toHaveBeenCalledOnce();
        expect(result).toEqual({ isSubscribed: true });
    });

    it("should initialize: create channel unconditionally when granted", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(createChannelMock).toHaveBeenCalledWith({
            id: "default",
            name: "Frak Wallet",
            importance: 4,
        });
    });

    it("should initialize: set up onTokenRefresh listener when granted", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(onTokenRefreshMock).toHaveBeenCalledOnce();
    });

    it("should initialize: set up listener when granted even if not subscribed (auto-recovery)", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        hasAnyGetMock.mockResolvedValue({ data: false });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(createChannelMock).toHaveBeenCalled();
        // Listener is always active when permission is granted so that
        // token refreshes can auto-recover from backend stale-token cleanup.
        // The opt-out flag in handleTokenRefresh prevents ghost resubscribes.
        expect(onTokenRefreshMock).toHaveBeenCalledOnce();
    });

    it("should initialize: NOT set up listener when denied", async () => {
        checkPermissionsMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(onTokenRefreshMock).not.toHaveBeenCalled();
    });

    it("should initialize: succeed even when listener setup fails", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        hasAnyGetMock.mockResolvedValue({ data: true });
        onTokenRefreshMock.mockRejectedValue(
            new Error("registerListener not allowed")
        );

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initialize();
        warnSpy.mockRestore();

        expect(result).toEqual({ isSubscribed: true });
        expect(createChannelMock).toHaveBeenCalled();
    });

    it("should onTokenRefresh event: sync token to backend", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        hasAnyGetMock.mockResolvedValue({ data: true });

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(capturedTokenRefreshHandler).toBeDefined();

        // Invoke the captured handler
        capturedTokenRefreshHandler?.({ token: "refreshed-token" });

        // Wait for async syncTokenToBackend to complete
        await vi.waitFor(() => {
            expect(putMock).toHaveBeenCalledWith({
                type: "fcm",
                token: "refreshed-token",
            });
        });
    });

    it("should showLocalNotification: call sendNotification and store in IndexedDB", async () => {
        const now = 1700000000000;
        vi.spyOn(Date, "now").mockReturnValue(now);

        const adapter = createTauriNotificationAdapter();

        await adapter.showLocalNotification({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
            data: { url: "https://example.com" },
        });

        expect(sendNotificationMock).toHaveBeenCalledWith({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
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
});
