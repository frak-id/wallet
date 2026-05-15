import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriNotificationAdapter } from "./tauriAdapter";

// Mocks for the tauri-plugin-frak-firebase IPC surface. After the FCM +
// Crashlytics merge, the adapter no longer imports `tauri-plugin-fcm` — every
// call goes through `getInvoke()` (raw `invoke("plugin:frak-firebase|...")`)
// or the `@tauri-apps/api/core` permission helpers / `addPluginListener`.

const {
    invokeMock,
    checkPermissionsCoreMock,
    requestPermissionsCoreMock,
    addPluginListenerMock,
    isAndroidMock,
    openUrlMock,
} = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    checkPermissionsCoreMock: vi.fn(),
    requestPermissionsCoreMock: vi.fn(),
    addPluginListenerMock: vi.fn(),
    isAndroidMock: vi.fn(),
    openUrlMock: vi.fn(),
}));

let capturedTokenRefreshHandler:
    | ((event: { token: string }) => void)
    | undefined;

const { putMock } = vi.hoisted(() => ({
    putMock: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    authenticatedWalletApi: {
        notifications: {
            tokens: {
                put: putMock,
            },
        },
    },
    getInvoke: vi.fn(async () => invokeMock),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_ANDROID() {
        return isAndroidMock();
    },
    isStandalonePwa: () => false,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
    openUrl: openUrlMock,
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
    checkPermissions: checkPermissionsCoreMock,
    requestPermissions: requestPermissionsCoreMock,
    addPluginListener: addPluginListenerMock,
}));

// Convenience: wrap an `invokeMock` call so each command can be matched in
// isolation. The adapter funnels FCM commands through `getInvoke().then(invoke)`
// using the strings below. Tests set per-command behaviour via
// `invokeMock.mockImplementation(...)` keyed on the command string.
const CMD = {
    GET_TOKEN: "plugin:frak-firebase|get_token",
    REGISTER: "plugin:frak-firebase|register",
    DELETE_TOKEN: "plugin:frak-firebase|delete_token",
    CREATE_CHANNEL: "plugin:frak-firebase|create_channel",
    OPEN_SETTINGS: "plugin:app-settings|open_notification_settings",
} as const;

type CmdHandler = (args?: unknown) => unknown;
type CmdHandlerMap = Partial<Record<(typeof CMD)[keyof typeof CMD], CmdHandler>>;

function installInvokeRouter(handlers: CmdHandlerMap) {
    invokeMock.mockImplementation(async (cmd: string, args?: unknown) => {
        const handler = (handlers as Record<string, CmdHandler | undefined>)[
            cmd
        ];
        if (handler) {
            return await handler(args);
        }
        // Default: resolve to undefined for any command the test didn't wire up.
        return undefined;
    });
}

describe.sequential("createTauriNotificationAdapter", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        checkPermissionsCoreMock.mockReset();
        requestPermissionsCoreMock.mockReset();
        addPluginListenerMock.mockReset();
        putMock.mockReset();
        isAndroidMock.mockReset();
        openUrlMock.mockReset();
        capturedTokenRefreshHandler = undefined;

        // Default invoke routing: every FCM command resolves successfully.
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => ({ token: "mock-fcm-token" }),
            [CMD.REGISTER]: () => undefined,
            [CMD.DELETE_TOKEN]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
            [CMD.OPEN_SETTINGS]: () => undefined,
        });

        // Default permission helpers: prompt for check, granted for request.
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockResolvedValue({
            notification: "granted",
        });

        addPluginListenerMock.mockImplementation(
            async (
                _plugin: string,
                _event: string,
                handler: (event: { token: string }) => void
            ) => {
                capturedTokenRefreshHandler = handler;
                return { unregister: vi.fn() };
            }
        );

        putMock.mockResolvedValue(undefined);
    });

    it("should call checkPermissions and return 'granted' when permission is granted", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "granted" });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(checkPermissionsCoreMock).toHaveBeenCalled();
        expect(result).toBe("granted");
    });

    it("should call checkPermissions and return 'denied' when permission is denied", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(checkPermissionsCoreMock).toHaveBeenCalled();
        expect(result).toBe("denied");
    });

    it("should call checkPermissions and return 'prompt' when permission is prompt", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "prompt" });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(checkPermissionsCoreMock).toHaveBeenCalled();
        expect(result).toBe("prompt");
    });

    it("should return 'prompt' when checkPermissions fails", async () => {
        checkPermissionsCoreMock.mockRejectedValue(new Error("Plugin error"));

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(result).toBe("prompt");
    });

    it("should return 'prompt-with-rationale' when plugin returns 'prompt-with-rationale'", async () => {
        checkPermissionsCoreMock.mockResolvedValue({
            notification: "prompt-with-rationale",
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getPermissionStatus();

        expect(checkPermissionsCoreMock).toHaveBeenCalled();
        expect(result).toBe("prompt-with-rationale");
    });

    it("should return 'granted' for requestPermission when plugin returns 'granted'", async () => {
        // First check returns denied so request fires.
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockResolvedValue({
            notification: "granted",
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionsCoreMock).toHaveBeenCalled();
        expect(result).toBe("granted");
    });

    it("should return 'denied' for requestPermission when plugin returns 'denied'", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockResolvedValue({
            notification: "denied",
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionsCoreMock).toHaveBeenCalled();
        expect(result).toBe("denied");
    });

    it("should map 'prompt' to 'prompt' for requestPermission", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockResolvedValue({
            notification: "prompt",
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(result).toBe("prompt");
    });

    it("should map 'prompt-with-rationale' to 'prompt-with-rationale' for requestPermission", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockResolvedValue({
            notification: "prompt-with-rationale",
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(result).toBe("prompt-with-rationale");
    });

    it("should requestPermission: propagate plugin errors", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockRejectedValue(
            new Error("Plugin not available")
        );

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.requestPermission()).rejects.toThrow(
            "Plugin not available"
        );
    });

    it("should return token when getToken succeeds", async () => {
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => ({ token: "test-token" }),
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getToken();

        expect(result).toEqual({ type: "fcm", token: "test-token" });
    });

    it("should return null when getToken fails", async () => {
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => {
                throw new Error("No token available");
            },
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.getToken();

        expect(result).toBeNull();
    });

    it("should create channel and set up listener during init", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(invokeMock).toHaveBeenCalledWith(CMD.CREATE_CHANNEL, {
            id: "default",
            name: "Frak Wallet",
            importance: 4,
        });
        expect(addPluginListenerMock).toHaveBeenCalledWith(
            "frak-firebase",
            "token-refresh",
            expect.any(Function)
        );
    });

    it("should eagerly register during init when permission is already granted", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "granted" });

        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(invokeMock).toHaveBeenCalledWith(CMD.REGISTER);
    });

    it("should skip eager register during init when permission is not granted", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });

        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(
            invokeMock.mock.calls.some(([cmd]) => cmd === CMD.REGISTER)
        ).toBe(false);
    });

    it("should warn when init fails", async () => {
        installInvokeRouter({
            [CMD.CREATE_CHANNEL]: () => {
                throw new Error("Channel creation failed");
            },
            [CMD.GET_TOKEN]: () => ({ token: "mock" }),
            [CMD.REGISTER]: () => undefined,
        });

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
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => ({ token: "new-fcm-token" }),
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });
        // Request fires because initial check is denied; it resolves to granted.
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockResolvedValue({
            notification: "granted",
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.subscribe();

        expect(requestPermissionsCoreMock).toHaveBeenCalled();
        expect(
            invokeMock.mock.calls.some(([cmd]) => cmd === CMD.REGISTER)
        ).toBe(true);
        expect(result).toEqual({ type: "fcm", token: "new-fcm-token" });
        expect(putMock).not.toHaveBeenCalled();
    });

    it("should subscribe: set up onTokenRefresh listener BEFORE register", async () => {
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => ({ token: "new-fcm-token" }),
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        const listenerCallOrder = addPluginListenerMock.mock.invocationCallOrder[0];
        const registerInvokeOrders = invokeMock.mock.calls
            .map(([cmd], idx) =>
                cmd === CMD.REGISTER
                    ? invokeMock.mock.invocationCallOrder[idx]
                    : undefined
            )
            .filter((x): x is number => x !== undefined);
        expect(registerInvokeOrders.length).toBeGreaterThan(0);
        expect(listenerCallOrder).toBeLessThan(registerInvokeOrders[0]!);
    });

    it("should subscribe: wait for token via onTokenRefresh when getToken rejects (cold start)", async () => {
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => {
                throw new Error("FCM token not available");
            },
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

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
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => {
                throw new Error("APNs entitlement missing");
            },
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "APNs entitlement missing"
        );
    });

    it("should subscribe: reject when token delivery times out", async () => {
        vi.useFakeTimers();
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => {
                throw new Error("FCM token not available");
            },
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

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
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => {
                throw new Error("FCM token not available");
            },
            [CMD.REGISTER]: () => {
                capturedTokenRefreshHandler?.({ token: "early-token" });
            },
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.subscribe();

        expect(result).toEqual({ type: "fcm", token: "early-token" });
    });

    it("should subscribe: throw when requestPermissions returns denied", async () => {
        checkPermissionsCoreMock.mockResolvedValue({ notification: "denied" });
        requestPermissionsCoreMock.mockResolvedValue({
            notification: "denied",
        });

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "Notification permission denied"
        );

        expect(
            invokeMock.mock.calls.some(([cmd]) => cmd === CMD.REGISTER)
        ).toBe(false);
        expect(
            invokeMock.mock.calls.some(([cmd]) => cmd === CMD.GET_TOKEN)
        ).toBe(false);
    });

    it("should subscribe: throw when register fails", async () => {
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => ({ token: "mock" }),
            [CMD.REGISTER]: () => {
                throw new Error("FCM registration failed");
            },
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

        const adapter = createTauriNotificationAdapter();
        await expect(adapter.subscribe()).rejects.toThrow(
            "FCM registration failed"
        );
    });

    it("should subscribe: warn and continue when listener setup fails", async () => {
        addPluginListenerMock.mockRejectedValue(
            new Error("registerListener not allowed")
        );
        installInvokeRouter({
            [CMD.GET_TOKEN]: () => ({ token: "direct-token" }),
            [CMD.REGISTER]: () => undefined,
            [CMD.CREATE_CHANNEL]: () => undefined,
        });

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

        expect(
            invokeMock.mock.calls.some(([cmd]) => cmd === CMD.DELETE_TOKEN)
        ).toBe(true);
        expect(putMock).not.toHaveBeenCalled();
    });

    it("should unsubscribe: clean up token refresh listener", async () => {
        const unregisterMock = vi.fn().mockResolvedValue(undefined);
        addPluginListenerMock.mockImplementation(
            async (
                _plugin: string,
                _event: string,
                handler: (event: { token: string }) => void
            ) => {
                capturedTokenRefreshHandler = handler;
                return { unregister: unregisterMock };
            }
        );

        const adapter = createTauriNotificationAdapter();

        await adapter.subscribe();
        expect(addPluginListenerMock).toHaveBeenCalled();

        await adapter.unsubscribe();
        expect(unregisterMock).toHaveBeenCalledOnce();

        addPluginListenerMock.mockClear();
        await adapter.subscribe();
        expect(addPluginListenerMock).toHaveBeenCalled();
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

    it("should onTokenRefresh event: emit token-update via EventTarget", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        expect(capturedTokenRefreshHandler).toBeDefined();

        const received: unknown[] = [];
        const controller = new AbortController();
        adapter.events.addEventListener(
            "token-update",
            (e) => received.push((e as CustomEvent).detail),
            { signal: controller.signal }
        );

        capturedTokenRefreshHandler?.({ token: "event-token" });

        expect(received).toEqual([{ type: "fcm", token: "event-token" }]);
        controller.abort();
    });

    it("should events: not receive events after listener is removed", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.initPromise;

        const received: unknown[] = [];
        const controller = new AbortController();
        adapter.events.addEventListener(
            "token-update",
            (e) => received.push((e as CustomEvent).detail),
            { signal: controller.signal }
        );

        controller.abort();
        capturedTokenRefreshHandler?.({ token: "after-abort" });

        expect(received).toEqual([]);
    });

    it("should openSettings: call invoke with app-settings plugin on both platforms", async () => {
        const adapter = createTauriNotificationAdapter();
        await adapter.openSettings();

        expect(invokeMock).toHaveBeenCalledWith(CMD.OPEN_SETTINGS);
        expect(openUrlMock).not.toHaveBeenCalled();
    });
});
