import type { PluginListener } from "@tauri-apps/api/core";
import {
    checkPermissions,
    createChannel,
    deleteToken,
    getToken,
    onTokenRefresh,
    type PermissionState,
    register,
    requestPermissions,
} from "tauri-plugin-fcm";
import { authenticatedWalletApi } from "../api/backendClient";
import type {
    NotificationAdapter,
    NotificationPermissionStatus,
    PushTokenPayload,
} from "./adapter";

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
            tokenRefreshListener = await onTokenRefresh(handleTokenRefresh);
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
            const response = await getToken();
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
            await createChannel({
                id: "default",
                name: "Frak Wallet",
                importance: 4,
            });
            await setupTokenRefreshListener();
        } catch (error) {
            console.warn("Tauri notification init failed:", error);
        }
    })();

    const adapter: NotificationAdapter = {
        initPromise,

        getPermissionStatus: async () => {
            try {
                const state = await checkPermissions();
                return mapPermission(state);
            } catch {
                return "prompt";
            }
        },

        requestPermission: async () => {
            // Check the current permission, if granted, early exit
            const current = await checkPermissions();
            if (current === "granted") return mapPermission(current);

            const state = await requestPermissions();
            return mapPermission(state);
        },

        getToken: async () => {
            await initPromise;

            try {
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
            await register();

            const token = await obtainToken();

            return { type: "fcm" as const, token };
        },

        unsubscribe: async () => {
            await teardownTokenRefreshListener();

            try {
                await deleteToken();
            } catch (error) {
                console.warn("Failed to delete FCM token", error);
            }
        },

        openSettings: async () => {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("plugin:app-settings|open_notification_settings");
        },

        events,
    };

    return adapter;
}
