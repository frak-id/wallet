import { isAndroid, isIOS } from "@frak-labs/app-essentials/utils/platform";
import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { addPluginListener, invoke } from "@tauri-apps/api/core";
import { authenticatedWalletApi } from "../api/backendClient";
import { notificationStorage } from "../storage/notifications";
import type { NotificationAdapter } from "./adapter";

async function getTauriNotificationPlugin() {
    try {
        return await import("@choochmeque/tauri-plugin-notifications-api");
    } catch {
        return undefined;
    }
}

/**
 * On iOS, registerForPushNotifications() returns a raw APNs hex token (not an FCM token).
 * Firebase's MessagingDelegate receives the FCM token asynchronously after the APNs token
 * is processed. We fetch it explicitly via the local "firebase" plugin's getFcmToken command.
 *
 * On Android, registerForPushNotifications() returns the FCM token directly.
 *
 * Throws on iOS if the FCM token is unavailable — storing an APNs token as "fcm" type
 * would silently fail on backend dispatch. The token refresh listener will handle
 * eventual delivery when Firebase completes the APNs→FCM exchange.
 */
async function getFcmToken(apnsOrFcmToken: string): Promise<string> {
    if (!isIOS()) {
        return apnsOrFcmToken;
    }

    const result = await invoke<{ token: string }>(
        "plugin:firebase|get_fcm_token"
    );
    return result.token;
}

export function createTauriNotificationAdapter(): NotificationAdapter {
    let permissionGranted = false;
    let hasPushTokenListener = false;

    const syncTokenToBackend = async (token: string) => {
        await authenticatedWalletApi.notifications.tokens.put({
            type: "fcm" as const,
            token,
        });
    };

    const ensurePushTokenListener = async () => {
        if (hasPushTokenListener) {
            return;
        }

        try {
            // On iOS, listen for FCM token updates from our Firebase plugin
            if (isIOS()) {
                await addPluginListener(
                    "firebase",
                    "fcm-token",
                    (event: { token: string }) => {
                        syncTokenToBackend(event.token).catch((error) => {
                            console.warn(
                                "Failed to sync refreshed FCM token to backend",
                                error
                            );
                        });
                    }
                );
            }

            // On Android, listen for push token refreshes from the notifications plugin
            // (which already returns FCM tokens directly)
            if (isAndroid()) {
                await addPluginListener(
                    "notifications",
                    "push-token",
                    (event: { token: string }) => {
                        syncTokenToBackend(event.token).catch((error) => {
                            console.warn(
                                "Failed to sync refreshed push token to backend",
                                error
                            );
                        });
                    }
                );
            }

            hasPushTokenListener = true;
        } catch (error) {
            console.warn("Failed to register push token listener", error);
        }
    };

    const adapter: NotificationAdapter = {
        isSupported: () => true,
        getPermissionStatus: () => (permissionGranted ? "granted" : "default"),
        requestPermission: async () => {
            try {
                const plugin = await getTauriNotificationPlugin();
                if (!plugin) return "denied";
                const result = await plugin.requestPermission();
                permissionGranted = result === "granted";
                return permissionGranted ? "granted" : "denied";
            } catch {
                return "denied";
            }
        },
        subscribe: async () => {
            const permission = await adapter.requestPermission();
            if (permission !== "granted") {
                return;
            }

            const plugin = await getTauriNotificationPlugin();
            if (!plugin) {
                return;
            }

            // Set up token refresh listener BEFORE registration so we don't
            // miss the first FCM token event from Firebase's MessagingDelegate
            await ensurePushTokenListener();

            // registerForPushNotifications returns FCM token on Android,
            // raw APNs hex token on iOS — getFcmToken handles the exchange
            const rawToken = await plugin.registerForPushNotifications();
            const token = await getFcmToken(rawToken);
            await syncTokenToBackend(token);
        },
        unsubscribe: async () => {
            permissionGranted = false;
            const plugin = await getTauriNotificationPlugin();
            if (plugin) {
                await plugin.unregisterForPushNotifications();
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
                const plugin = await getTauriNotificationPlugin();
                if (!plugin) return { isSubscribed: false };
                const granted = await plugin.isPermissionGranted();
                permissionGranted = granted;

                if (granted) {
                    await ensurePushTokenListener();
                }

                if (isAndroid()) {
                    await plugin.createChannel({
                        id: "default",
                        name: "Frak Wallet",
                        importance: 4,
                    });
                }

                return { isSubscribed: await adapter.isSubscribed() };
            } catch {
                return { isSubscribed: false };
            }
        },
        showLocalNotification: async (payload: NotificationPayload) => {
            try {
                const plugin = await getTauriNotificationPlugin();
                if (plugin) {
                    await plugin.sendNotification({
                        title: payload.title,
                        body: payload.body,
                        icon: payload.icon,
                    });
                }
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
