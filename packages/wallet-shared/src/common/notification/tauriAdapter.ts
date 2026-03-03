import { isAndroid } from "@frak-labs/app-essentials/utils/platform";
import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { notificationStorage } from "../storage/notifications";
import type { NotificationAdapter } from "./adapter";

async function getTauriNotificationPlugin() {
    try {
        return await import("@tauri-apps/plugin-notification");
    } catch {
        return undefined;
    }
}

export function createTauriNotificationAdapter(): NotificationAdapter {
    let permissionGranted = false;

    return {
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
            try {
                const plugin = await getTauriNotificationPlugin();
                if (!plugin) return;
                const result = await plugin.requestPermission();
                permissionGranted = result === "granted";
            } catch {}
        },
        unsubscribe: async () => {},
        isSubscribed: async () => permissionGranted,
        initialize: async () => {
            try {
                const plugin = await getTauriNotificationPlugin();
                if (!plugin) return { isSubscribed: false };
                const granted = await plugin.isPermissionGranted();
                permissionGranted = granted;

                if (isAndroid()) {
                    await plugin.createChannel({
                        id: "default",
                        name: "Frak Wallet",
                        importance: 4,
                    });
                }

                return { isSubscribed: permissionGranted };
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
            } catch {}

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
}
