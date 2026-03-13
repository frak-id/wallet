import { createStore, get, set } from "idb-keyval";
import type { NotificationModel } from "./NotificationModel";

// Custom store: separate database to avoid object store conflicts
const notificationStore = createStore(
    "frak-wallet-notifications",
    "notifications"
);
const NOTIFICATIONS_KEY = "notifications";

export const notificationStorage = {
    async add(notification: NotificationModel): Promise<void> {
        const existing =
            (await get<NotificationModel[]>(
                NOTIFICATIONS_KEY,
                notificationStore
            )) || [];
        existing.push(notification);
        await set(NOTIFICATIONS_KEY, existing, notificationStore);
    },

    async getAll(): Promise<NotificationModel[]> {
        try {
            const notifications =
                (await get<NotificationModel[]>(
                    NOTIFICATIONS_KEY,
                    notificationStore
                )) || [];
            return notifications.sort((a, b) => b.timestamp - a.timestamp);
        } catch (err) {
            // If store doesn't exist yet (no writes have been made), return empty array
            if (err instanceof DOMException && err.name === "NotFoundError") {
                return [];
            }
            console.error("Failed to get notifications:", err);
            return [];
        }
    },
};
