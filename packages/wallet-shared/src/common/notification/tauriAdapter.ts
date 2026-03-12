import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
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
    sendNotification,
} from "tauri-plugin-fcm";
import { authenticatedWalletApi } from "../api/backendClient";
import { notificationStorage } from "../storage/notifications";
import type { NotificationAdapter, NotificationInitResult } from "./adapter";

const FCM_TOKEN_DELIVERY_TIMEOUT_MS = 10_000;

function mapPermission(state: PermissionState): NotificationPermission {
    if (state === "granted") return "granted";
    if (state === "denied") return "denied";
    return "default";
}

export function createTauriNotificationAdapter(): NotificationAdapter {
    let permissionGranted = false;
    let tokenRefreshListener: PluginListener | undefined;
    let pendingTokenResolve: ((token: string) => void) | undefined;
    let earlyToken: string | undefined;

    const syncTokenToBackend = async (token: string) => {
        await authenticatedWalletApi.notifications.tokens.put({
            type: "fcm" as const,
            token,
        });
    };

    // Token refresh: buffer for in-flight subscribe, otherwise sync to backend
    const handleTokenRefresh = (event: { token: string }) => {
        earlyToken = event.token;
        if (pendingTokenResolve) {
            pendingTokenResolve(event.token);
            pendingTokenResolve = undefined;
            return;
        }
        // Background refresh: proactively sync to backend
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

    const initPromise: Promise<NotificationInitResult> = (async () => {
        try {
            const state = await checkPermissions();
            const permission = mapPermission(state);
            permissionGranted = permission === "granted";

            if (!permissionGranted) {
                return { permissionGranted: false, localToken: null };
            }

            await createChannel({
                id: "default",
                name: "Frak Wallet",
                importance: 4,
            });

            // Best-effort token check — no waiting on cold start
            try {
                const response = await getToken();
                if (response.token) {
                    await setupTokenRefreshListener();
                    return {
                        permissionGranted: true,
                        localToken: {
                            type: "fcm" as const,
                            token: response.token,
                        },
                    };
                }
            } catch {
                // No existing token (cold start or never registered)
            }

            return { permissionGranted: true, localToken: null };
        } catch {
            return { permissionGranted: false, localToken: null };
        }
    })();

    const adapter: NotificationAdapter = {
        initPromise,

        isSupported: () => true,

        getPermissionStatus: () => (permissionGranted ? "granted" : "default"),

        requestPermission: async () => {
            const state = await requestPermissions();
            const permission = mapPermission(state);
            permissionGranted = permission === "granted";
            return permission;
        },

        subscribe: async () => {
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
            permissionGranted = false;

            await teardownTokenRefreshListener();

            try {
                await deleteToken();
            } catch (error) {
                console.warn("Failed to delete FCM token", error);
            }
        },

        showLocalNotification: async (payload: NotificationPayload) => {
            try {
                await sendNotification({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon,
                });
            } catch (error) {
                console.warn("Failed to send Tauri notification", error);
            }

            await notificationStorage.add({
                id: crypto.randomUUID(),
                title: payload.title,
                body: payload.body,
                icon: payload.icon,
                data: payload.data,
                timestamp: Date.now(),
            });
        },
    };

    return adapter;
}
