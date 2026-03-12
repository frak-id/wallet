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

const { putMock } = vi.hoisted(() => ({
    putMock: vi.fn(),
}));

vi.mock("../api/backendClient", () => ({
    authenticatedWalletApi: {
        notifications: {
            tokens: {
                put: putMock,
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
        capturedTokenRefreshHandler = undefined;

        getTokenMock.mockResolvedValue({ token: "mock-fcm-token" });
        requestPermissionsMock.mockResolvedValue("granted");
        checkPermissionsMock.mockResolvedValue("denied");
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

    it("should requestPermission: propagate plugin errors", async () => {
        requestPermissionsMock.mockRejectedValue(
            new Error("Plugin not available")
        );

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.requestPermission()).rejects.toThrow(
            "Plugin not available"
        );
    });

    it("should subscribe: return PushTokenPayload and not call backend", async () => {
        getTokenMock.mockResolvedValue({ token: "new-fcm-token" });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.subscribe();

        expect(requestPermissionsMock).toHaveBeenCalledOnce();
        expect(registerMock).toHaveBeenCalledOnce();
        expect(result).toEqual({ type: "fcm", token: "new-fcm-token" });
        expect(putMock).not.toHaveBeenCalled();
    });

    it("should subscribe: set up onTokenRefresh listener BEFORE register", async () => {
        getTokenMock.mockResolvedValue({ token: "new-fcm-token" });

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        const listenerCallOrder =
            onTokenRefreshMock.mock.invocationCallOrder[0];
        const registerCallOrder = registerMock.mock.invocationCallOrder[0];
        expect(listenerCallOrder).toBeLessThan(registerCallOrder);
    });

    it("should subscribe: wait for token via onTokenRefresh when getToken rejects (cold start)", async () => {
        getTokenMock.mockRejectedValue(new Error("FCM token not available"));

        const adapter = createTauriNotificationAdapter();
        const subscribePromise = adapter.subscribe();

        await new Promise((r) => setTimeout(r, 0));

        capturedTokenRefreshHandler?.({ token: "late-delivered-token" });

        const result = await subscribePromise;
        expect(result).toEqual({
            type: "fcm",
            token: "late-delivered-token",
        });
    });

    it("should subscribe: propagate real APNs error from getToken instead of timing out", async () => {
        getTokenMock.mockRejectedValue(new Error("APNs entitlement missing"));

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "APNs entitlement missing"
        );
    });

    it("should subscribe: reject when token delivery times out", async () => {
        vi.useFakeTimers();
        getTokenMock.mockRejectedValue(new Error("FCM token not available"));

        const adapter = createTauriNotificationAdapter();
        const subscribePromise = adapter.subscribe();

        const assertion = expect(subscribePromise).rejects.toThrow(
            "FCM token delivery timed out"
        );

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        vi.useRealTimers();
    });

    it("should subscribe: use buffered token when refresh arrives before getToken", async () => {
        getTokenMock.mockRejectedValue(new Error("FCM token not available"));

        registerMock.mockImplementation(async () => {
            capturedTokenRefreshHandler?.({ token: "early-token" });
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.subscribe();

        expect(result).toEqual({ type: "fcm", token: "early-token" });
    });

    it("should subscribe: throw when requestPermissions returns denied", async () => {
        requestPermissionsMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "Notification permission denied"
        );

        expect(registerMock).not.toHaveBeenCalled();
        expect(getTokenMock).not.toHaveBeenCalled();
    });

    it("should subscribe: throw when register fails", async () => {
        registerMock.mockRejectedValue(new Error("FCM registration failed"));

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "FCM registration failed"
        );
    });

    it("should subscribe: warn and continue when listener setup fails", async () => {
        onTokenRefreshMock.mockRejectedValue(
            new Error("registerListener not allowed")
        );
        getTokenMock.mockResolvedValue({ token: "direct-token" });

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const adapter = createTauriNotificationAdapter();
        const result = await adapter.subscribe();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("FCM token refresh listener unavailable"),
            expect.any(Error)
        );
        warnSpy.mockRestore();

        expect(result).toEqual({ type: "fcm", token: "direct-token" });
    });

    it("should unsubscribe: call deleteToken without calling backend", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.unsubscribe();

        expect(deleteTokenMock).toHaveBeenCalledOnce();
        expect(putMock).not.toHaveBeenCalled();
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

        await adapter.subscribe();
        expect(onTokenRefreshMock).toHaveBeenCalledOnce();

        await adapter.unsubscribe();
        expect(unregisterMock).toHaveBeenCalledOnce();

        onTokenRefreshMock.mockClear();
        await adapter.subscribe();
        expect(onTokenRefreshMock).toHaveBeenCalledOnce();
    });

    it("should initPromise: check permissions, create channel, and return localToken when existing token", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "existing-token" });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initPromise;

        expect(checkPermissionsMock).toHaveBeenCalledOnce();
        expect(createChannelMock).toHaveBeenCalledWith({
            id: "default",
            name: "Frak Wallet",
            importance: 4,
        });
        expect(result).toEqual({
            permissionGranted: true,
            localToken: { type: "fcm", token: "existing-token" },
        });
    });

    it("should initPromise: set up token refresh listener when token exists", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "existing-token" });

        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(onTokenRefreshMock).toHaveBeenCalledOnce();
    });

    it("should initPromise: return permissionGranted false when denied", async () => {
        checkPermissionsMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initPromise;

        expect(result).toEqual({
            permissionGranted: false,
            localToken: null,
        });
        expect(createChannelMock).not.toHaveBeenCalled();
    });

    it("should initPromise: return localToken null when no existing token", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockRejectedValue(new Error("No token"));

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initPromise;

        expect(result).toEqual({
            permissionGranted: true,
            localToken: null,
        });
        expect(createChannelMock).toHaveBeenCalled();
    });

    it("should initPromise: return gracefully when checkPermissions fails", async () => {
        checkPermissionsMock.mockRejectedValue(new Error("Plugin error"));

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initPromise;

        expect(result).toEqual({
            permissionGranted: false,
            localToken: null,
        });
    });

    it("should onTokenRefresh event: sync token to backend", async () => {
        checkPermissionsMock.mockResolvedValue("granted");
        getTokenMock.mockResolvedValue({ token: "existing-token" });

        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(capturedTokenRefreshHandler).toBeDefined();

        capturedTokenRefreshHandler?.({ token: "refreshed-token" });

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
