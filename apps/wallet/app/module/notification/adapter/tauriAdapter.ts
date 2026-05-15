import { authenticatedWalletApi, getInvoke } from "@frak-labs/wallet-shared";
import {
    addPluginListener,
    checkPermissions as checkPermissions_,
    type PluginListener,
    requestPermissions as requestPermissions_,
} from "@tauri-apps/api/core";
import i18next from "i18next";
import type {
    NotificationAdapter,
    NotificationPermissionStatus,
    PushTokenPayload,
} from "./adapter";

/**
 * Permission state shape returned by the `frak-firebase` plugin.
 *
 * Mirrors `@tauri-apps/api/core` PermissionState — declared inline because the
 * merged plugin no longer ships a typed JS bindings package. Both halves
 * (FCM + Crashlytics) are consumed via raw `invoke()` strings (see
 * `packages/wallet-shared/src/common/analytics/crashlytics.ts` for the
 * Crashlytics half).
 */
type PermissionState =
    | "granted"
    | "denied"
    | "prompt"
    | "prompt-with-rationale";

const PLUGIN_NAME = "frak-firebase";
const INVOKE_GET_TOKEN = "plugin:frak-firebase|get_token";
const INVOKE_REGISTER = "plugin:frak-firebase|register";
const INVOKE_DELETE_TOKEN = "plugin:frak-firebase|delete_token";
const INVOKE_CREATE_CHANNEL = "plugin:frak-firebase|create_channel";

async function fcmGetToken(): Promise<{ token: string }> {
    const invoke = await getInvoke();
    return invoke<{ token: string }>(INVOKE_GET_TOKEN);
}

async function fcmRegister(): Promise<void> {
    const invoke = await getInvoke();
    await invoke(INVOKE_REGISTER);
}

async function fcmDeleteToken(): Promise<void> {
    const invoke = await getInvoke();
    await invoke(INVOKE_DELETE_TOKEN);
}

async function fcmCreateChannel(opts: {
    id: string;
    name: string;
    importance: number;
}): Promise<void> {
    const invoke = await getInvoke();
    // Args are passed flat (top-level) because the native plugins decode
    // via `parseArgs(CreateChannelArgs)` which expects the payload at the
    // root of the invoke message — matching the convention used by the
    // sibling `recovery-hint` / `frak-share` plugins.
    await invoke(INVOKE_CREATE_CHANNEL, opts);
}

async function fcmCheckPermissions(): Promise<PermissionState> {
    const result = await checkPermissions_<{ notification: PermissionState }>(
        PLUGIN_NAME
    );
    return result.notification;
}

async function fcmRequestPermissions(): Promise<PermissionState> {
    const result = await requestPermissions_<{
        notification: PermissionState;
    }>(PLUGIN_NAME);
    return result.notification;
}

async function fcmOnTokenRefresh(
    handler: (event: { token: string }) => void
): Promise<PluginListener> {
    return await addPluginListener(PLUGIN_NAME, "token-refresh", handler);
}

const FCM_TOKEN_DELIVERY_TIMEOUT_MS = 10_000;

function mapPermission(state: PermissionState): NotificationPermissionStatus {
    if (state === "granted") return "granted";
    if (state === "denied") return "denied";
    if (state === "prompt-with-rationale") return "prompt-with-rationale";
    return "prompt";
}

export function createTauriNotificationAdapter(): NotificationAdapter {
    let tokenRefreshListener: PluginListener | undefined;
    let pendingTokenResolve: ((token: string) => void) | undefined;
    let earlyToken: string | undefined;
    const events = new EventTarget();

    const syncTokenToBackend = async (token: string) => {
        await authenticatedWalletApi.notifications.tokens.put({
            type: "fcm" as const,
            token,
            locale: i18next.language?.split("-")[0],
        });
    };

    const handleTokenRefresh = (event: { token: string }) => {
        earlyToken = event.token;
        const payload: PushTokenPayload = { type: "fcm", token: event.token };
        events.dispatchEvent(
            new CustomEvent("token-update", { detail: payload })
        );
        if (pendingTokenResolve) {
            pendingTokenResolve(event.token);
            pendingTokenResolve = undefined;
            return;
        }
        syncTokenToBackend(event.token).catch((error) => {
            console.warn(
                "Failed to sync refreshed FCM token to backend",
                error
            );
        });
    };

    const setupTokenRefreshListener = async (): Promise<boolean> => {
        if (tokenRefreshListener !== undefined) return true;
        try {
            tokenRefreshListener = await fcmOnTokenRefresh(handleTokenRefresh);
            return true;
        } catch (error) {
            console.warn("FCM token refresh listener unavailable:", error);
            return false;
        }
    };

    const teardownTokenRefreshListener = async () => {
        if (tokenRefreshListener) {
            await tokenRefreshListener.unregister();
            tokenRefreshListener = undefined;
        }
    };

    const obtainToken = async (): Promise<string> => {
        try {
            const response = await fcmGetToken();
            if (response.token) return response.token;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (!msg.includes("FCM token not available")) {
                throw error;
            }
        }

        if (earlyToken) {
            const token = earlyToken;
            earlyToken = undefined;
            return token;
        }

        return new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingTokenResolve = undefined;
                reject(new Error("FCM token delivery timed out"));
            }, FCM_TOKEN_DELIVERY_TIMEOUT_MS);
            pendingTokenResolve = (t: string) => {
                clearTimeout(timer);
                resolve(t);
            };
        });
    };

    const initPromise: Promise<void> = (async () => {
        try {
            await fcmCreateChannel({
                id: "default",
                name: "Frak Wallet",
                importance: 4,
            });
            await setupTokenRefreshListener();
            // iOS requires an explicit register() before
            // `Messaging.token()` returns a value, unlike Android FCM which
            // auto-registers on app init. If the OS-level permission was
            // already granted in a previous session (or via system Settings
            // out-of-band), proactively register so the FCM token is cached
            // before the settings page reads it. No-op on Android.
            const permission = await fcmCheckPermissions();
            if (permission === "granted") {
                await fcmRegister();
            }
        } catch (error) {
            console.warn("Tauri notification init failed:", error);
        }
    })();

    const adapter: NotificationAdapter = {
        initPromise,

        isSupported: () => true,

        getPermissionStatus: async () => {
            try {
                const state = await fcmCheckPermissions();
                return mapPermission(state);
            } catch {
                return "prompt";
            }
        },

        requestPermission: async () => {
            // Check the current permission, if granted, early exit
            const current = await fcmCheckPermissions();
            if (current === "granted") return mapPermission(current);

            const state = await fcmRequestPermissions();
            return mapPermission(state);
        },

        getToken: async () => {
            await initPromise;

            try {
                // Lazy register safety net: covers the case where the OS
                // permission was denied at app start (init skipped the eager
                // register) and later flipped to granted out-of-band — e.g.
                // user came back from system Settings. iOS requires
                // register() before getToken returns a value; this call
                // is idempotent once APNs is already registered.
                const permission = await fcmCheckPermissions();
                if (permission === "granted") {
                    try {
                        await fcmRegister();
                    } catch (error) {
                        console.warn("FCM lazy register failed:", error);
                    }
                }
                const token = await obtainToken();
                return { type: "fcm", token: token };
            } catch (e) {
                console.warn("Unable to obtain notification token", e);
                return null;
            }
        },

        subscribe: async () => {
            await initPromise;

            const permission = await adapter.requestPermission();
            if (permission !== "granted") {
                throw new Error(
                    `Notification permission ${permission}: user denied or dismissed the prompt`
                );
            }

            earlyToken = undefined;
            await setupTokenRefreshListener();
            await fcmRegister();

            const token = await obtainToken();

            return { type: "fcm" as const, token };
        },

        unsubscribe: async () => {
            await teardownTokenRefreshListener();

            try {
                await fcmDeleteToken();
            } catch (error) {
                console.warn("Failed to delete FCM token", error);
            }
        },

        openSettings: async () => {
            const invoke = await getInvoke();
            await invoke("plugin:app-settings|open_notification_settings");
        },

        events,
    };

    return adapter;
}
