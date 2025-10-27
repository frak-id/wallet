import { createStore, get, set } from "idb-keyval";
import type { NotificationModel } from "./NotificationModel";

// Custom store: database "frak-wallet", store "notifications"
const notificationStore = createStore("frak-wallet", "notifications");
const NOTIFICATIONS_KEY = "notifications";

/**
 * Lightweight notification storage using idb-keyval
 * Database: frak-wallet, Store: notifications
 */
export const notificationStorage = {
    /**
     * Add a notification to the store
     */
    async add(notification: NotificationModel): Promise<void> {
        const existing =
            (await get<NotificationModel[]>(
                NOTIFICATIONS_KEY,
                notificationStore
            )) || [];
        existing.push(notification);
        await set(NOTIFICATIONS_KEY, existing, notificationStore);
    },

    /**
     * Get all notifications sorted by timestamp (newest first)
     */
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
            // Log unexpected errors for debugging
            console.error("Failed to get notifications:", err);
            return [];
        }
    },
};
