import { isAndroid } from "@frak-labs/app-essentials/utils/platform";
import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { addPluginListener } from "@tauri-apps/api/core";
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

export function createTauriNotificationAdapter(): NotificationAdapter {
    let permissionGranted = false;
    let hasPushTokenListener = false;

    const syncTokenToBackend = async (token: string) => {
        try {
            await authenticatedWalletApi.notifications.tokens.put({
                type: "fcm" as const,
                token,
            });
        } catch (error) {
            console.warn("Failed to sync push token to backend", error);
        }
    };

    const ensurePushTokenListener = async () => {
        if (hasPushTokenListener) {
            return;
        }

        try {
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

            const token = await plugin.registerForPushNotifications();
            await ensurePushTokenListener();
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
                    plugin.sendNotification({
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
