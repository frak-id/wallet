import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import type { PluginListener } from "@tauri-apps/api/core";
import { createStore, get, set } from "idb-keyval";
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

/**
 * Persisted opt-out flag for push notifications.
 *
 * Distinguishes "user explicitly unsubscribed" (opt-out = true) from
 * "backend pruned a stale token" (opt-out = false, hasAny = false).
 * Without this, both states collapse into permission-granted + no-backend-token,
 * making auto-recovery from server-side cleanup impossible without also
 * ghost-resubscribing users who opted out.
 */
const notificationPrefsStore = createStore(
    "frak-wallet-notifications",
    "preferences"
);
const OPT_OUT_KEY = "push-opt-out";

async function getPushOptOut(): Promise<boolean> {
    return (await get<boolean>(OPT_OUT_KEY, notificationPrefsStore)) ?? false;
}

async function setPushOptOut(value: boolean): Promise<void> {
    await set(OPT_OUT_KEY, value, notificationPrefsStore);
}

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
     * waiting, resolves the pending promise directly. Otherwise syncs to
     * backend only when the user has not explicitly opted out.
     */
    const handleTokenRefresh = (event: { token: string }) => {
        earlyToken = event.token;
        if (pendingTokenResolve) {
            pendingTokenResolve(event.token);
            pendingTokenResolve = undefined;
            return;
        }
        // Background refresh: only sync if user hasn't explicitly opted out.
        // This distinguishes "backend pruned stale token" (should recover)
        // from "user clicked unsubscribe" (should stay unsubscribed).
        getPushOptOut()
            .then((optedOut) => {
                if (optedOut) return;
                return syncTokenToBackend(event.token);
            })
            .catch((error) => {
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
     *
     * First tries getToken() directly — the plugin now surfaces APNs
     * registration errors (missing entitlement, cert mismatch) through
     * getToken() rejection, so no separate onPushError listener is needed.
     * Falls back to the earlyToken buffer or waits for delivery via
     * onTokenRefresh on cold start.
     */
    const obtainToken = async (): Promise<string> => {
        // First attempt — plugin rejects with the actual APNs error when
        // registration failed (missing entitlement, cert mismatch, etc.),
        // or with "FCM token not available" on cold-start race.
        // Re-throw real registration errors immediately instead of falling
        // through to the 10s timeout where no token-refresh will ever arrive.
        try {
            const response = await getToken();
            if (response.token) return response.token;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (!msg.includes("FCM token not available")) {
                throw error;
            }
            // Cold-start race — token arrives via onTokenRefresh below
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

            // Clear opt-out only after full subscribe succeeds.
            // If any step above threw, the flag stays set so the
            // always-active token refresh listener won't ghost-resubscribe.
            await setPushOptOut(false);
        },

        unsubscribe: async () => {
            permissionGranted = false;

            // Mark explicit opt-out BEFORE cleanup so that any in-flight
            // token-refresh handler sees the flag immediately.
            await setPushOptOut(true);

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
                const optedOut = await getPushOptOut();
                if (optedOut) {
                    return false;
                }
            } catch (error) {
                console.warn("Failed to read push opt-out status", error);
            }

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

                    // Always listen for token refreshes when permission is
                    // granted. The opt-out flag in handleTokenRefresh prevents
                    // ghost re-subscriptions for users who explicitly
                    // unsubscribed, while allowing auto-recovery when the
                    // backend pruned a stale token.
                    await trySetupTokenRefreshListener();
                }

                const isSubscribed = await adapter.isSubscribed();
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
