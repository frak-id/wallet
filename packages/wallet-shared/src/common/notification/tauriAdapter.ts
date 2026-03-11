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
import type { NotificationAdapter } from "./adapter";

/** Time to wait for FCM to deliver a token after cold-start registration */
const FCM_TOKEN_DELIVERY_TIMEOUT_MS = 10_000;

function mapPermission(state: PermissionState): NotificationPermission {
    if (state === "granted") return "granted";
    if (state === "denied") return "denied";
    return "default";
}

export function createTauriNotificationAdapter(): NotificationAdapter {
    let permissionGranted = false;
    let hasTokenRefreshListener = false;
    let tokenRefreshListener: PluginListener | undefined;
    let pendingTokenResolve: ((token: string) => void) | undefined;
    /** Buffers early token-refresh events that arrive before subscribe()
     *  installs pendingTokenResolve (between register() and getToken()). */
    let earlyToken: string | undefined;

    const syncTokenToBackend = async (token: string) => {
        await authenticatedWalletApi.notifications.tokens.put({
            type: "fcm" as const,
            token,
        });
    };

    /**
     * Shared handler for FCM token refresh events.
     *
     * Always buffers the token for an in-flight subscribe() that hasn't
     * reached its pending-delivery await yet. If subscribe() IS already
     * waiting, resolves the pending promise directly. Otherwise performs
     * a fire-and-forget backend sync.
     */
    const handleTokenRefresh = (event: { token: string }) => {
        earlyToken = event.token;
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

    /**
     * Best-effort setup of the token refresh listener.
     * Returns true if listener is active, false if the plugin doesn't
     * support registerListener (command not found).
     */
    const trySetupTokenRefreshListener = async (): Promise<boolean> => {
        if (hasTokenRefreshListener) return true;
        try {
            tokenRefreshListener = await onTokenRefresh(handleTokenRefresh);
            hasTokenRefreshListener = true;
            return true;
        } catch (error) {
            console.warn(
                "FCM token refresh listener unavailable, will retry getToken instead:",
                error
            );
            return false;
        }
    };

    /**
     * Obtain the FCM token after registration.
     * First tries getToken() directly, then falls back to the
     * earlyToken buffer or waits for delivery via onTokenRefresh.
     */
    const obtainToken = async (): Promise<string> => {
        // First attempt — plugin rejects when token isn't ready yet
        // on cold start, so catch and fall through to listener delivery
        try {
            const response = await getToken();
            if (response.token) return response.token;
        } catch {
            // Expected on cold start; token arrives via onTokenRefresh
        }

        // If the listener captured an early token, use it
        if (earlyToken) {
            const token = earlyToken;
            earlyToken = undefined;
            return token;
        }

        // Wait for token delivery via onTokenRefresh
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

    const adapter: NotificationAdapter = {
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

            // Clear stale buffer from previous background refreshes
            earlyToken = undefined;

            // Set up token refresh listener BEFORE registration
            await trySetupTokenRefreshListener();

            // Register for push notifications
            await register();

            // Get current token — may fail on cold start (race condition)
            const token = await obtainToken();

            // Sync to backend — failure must propagate to caller
            await syncTokenToBackend(token);
        },

        unsubscribe: async () => {
            permissionGranted = false;

            // Clean up token refresh listener to prevent stale re-subscriptions
            if (tokenRefreshListener) {
                await tokenRefreshListener.unregister();
                tokenRefreshListener = undefined;
                hasTokenRefreshListener = false;
            }

            try {
                await deleteToken();
            } catch (error) {
                console.warn("Failed to delete FCM token", error);
            }

            try {
                await authenticatedWalletApi.notifications.tokens.delete();
            } catch (error) {
                console.warn("Failed to delete push token from backend", error);
            }
        },

        isSubscribed: async () => {
            try {
                const result =
                    await authenticatedWalletApi.notifications.tokens.hasAny.get();
                return result.data ?? false;
            } catch (error) {
                console.warn("Failed to fetch push subscription status", error);
                return false;
            }
        },

        initialize: async () => {
            try {
                const state = await checkPermissions();
                const permission = mapPermission(state);
                permissionGranted = permission === "granted";

                if (permission === "granted") {
                    // Create notification channel (Android requirement)
                    await createChannel({
                        id: "default",
                        name: "Frak Wallet",
                        importance: 4,
                    });
                }

                const isSubscribed = await adapter.isSubscribed();

                // Only attach token refresh listener when user opted in,
                // otherwise a plugin-minted token on app start silently
                // re-subscribes users who explicitly unsubscribed.
                if (permission === "granted" && isSubscribed) {
                    await trySetupTokenRefreshListener();
                }

                return { isSubscribed };
            } catch {
                return { isSubscribed: false };
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
