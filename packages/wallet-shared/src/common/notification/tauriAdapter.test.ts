import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriNotificationAdapter } from "./tauriAdapter";

const {
    getTokenMock,
    requestPermissionsMock,
    checkPermissionsMock,
    registerMock,
    deleteTokenMock,
    createChannelMock,
    onTokenRefreshMock,
} = vi.hoisted(() => ({
    getTokenMock: vi.fn(),
    requestPermissionsMock: vi.fn(),
    checkPermissionsMock: vi.fn(),
    registerMock: vi.fn(),
    deleteTokenMock: vi.fn(),
    createChannelMock: vi.fn(),
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
    onTokenRefresh: onTokenRefreshMock,
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
    beforeEach(() => {
        getTokenMock.mockReset();
        requestPermissionsMock.mockReset();
        checkPermissionsMock.mockReset();
        registerMock.mockReset();
        deleteTokenMock.mockReset();
        createChannelMock.mockReset();
        onTokenRefreshMock.mockReset();
        putMock.mockReset();
        capturedTokenRefreshHandler = undefined;

        getTokenMock.mockResolvedValue({ token: "mock-fcm-token" });
        requestPermissionsMock.mockResolvedValue("granted");
        checkPermissionsMock.mockResolvedValue("denied");
        registerMock.mockResolvedValue(undefined);
        deleteTokenMock.mockResolvedValue(undefined);
        createChannelMock.mockResolvedValue(undefined);
        onTokenRefreshMock.mockImplementation(
            (handler: (event: { token: string }) => void) => {
                capturedTokenRefreshHandler = handler;
                return Promise.resolve({ unregister: vi.fn() });
            }
        );
        putMock.mockResolvedValue(undefined);
    });

    it("should call checkPermissions and return 'granted' when permission is granted", async () => {
        checkPermissionsMock.mockResolvedValue("granted");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(checkPermissionsMock).toHaveBeenCalledOnce();
        expect(result).toBe("granted");
    });

    it("should call checkPermissions and return 'denied' when permission is denied", async () => {
        checkPermissionsMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(checkPermissionsMock).toHaveBeenCalledOnce();
        expect(result).toBe("denied");
    });

    it("should call checkPermissions and return 'default' when permission is prompt", async () => {
        checkPermissionsMock.mockResolvedValue("prompt");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(checkPermissionsMock).toHaveBeenCalledOnce();
        expect(result).toBe("default");
    });

    it("should return 'default' when checkPermissions fails", async () => {
        checkPermissionsMock.mockRejectedValue(new Error("Plugin error"));

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(result).toBe("default");
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

    it("should return token when getToken succeeds", async () => {
        getTokenMock.mockResolvedValue({ token: "test-token" });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getToken();

        expect(result).toEqual({ type: "fcm", token: "test-token" });
    });

    it("should return null when getToken fails", async () => {
        getTokenMock.mockRejectedValue(new Error("No token available"));

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getToken();

        expect(result).toBeNull();
    });

    it("should create channel and set up listener during init", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(createChannelMock).toHaveBeenCalledWith({
            id: "default",
            name: "Frak Wallet",
            importance: 4,
        });
        expect(onTokenRefreshMock).toHaveBeenCalledOnce();
    });

    it("should warn when init fails", async () => {
        createChannelMock.mockRejectedValue(
            new Error("Channel creation failed")
        );

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Tauri notification init failed"),
            expect.any(Error)
        );
        warnSpy.mockRestore();
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

    it("should onTokenRefresh event: sync token to backend", async () => {
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
});
