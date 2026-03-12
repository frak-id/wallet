import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { createTauriNotificationAdapter } from "./tauriAdapter";
import { createWebNotificationAdapter } from "./webAdapter";

export type PushTokenPayload =
    | {
          type: "web-push";
          subscription: {
              endpoint: string;
              keys: { p256dh: string; auth: string };
              expirationTime?: number;
          };
      }
    | { type: "fcm"; token: string };

export type NotificationInitResult = {
    permissionGranted: boolean;
    localToken: PushTokenPayload | null;
};

/**
 * Pure platform abstraction for push notifications.
 * Manages OS permissions, push subscriptions, and local notifications.
 * Does NOT call the backend for subscribe/unsubscribe — that belongs
 * in mutation hooks. The Tauri adapter's internal token-refresh
 * listener is the sole exception (background maintenance).
 */
export type NotificationAdapter = {
    isSupported: () => boolean;
    getPermissionStatus: () => NotificationPermission;
    requestPermission: () => Promise<NotificationPermission>;
    /**
     * Create a platform push subscription.
     * Returns token payload — caller syncs to backend.
     */
    subscribe: () => Promise<PushTokenPayload>;
    /**
     * Tear down platform push subscription.
     * Caller deletes from backend.
     */
    unsubscribe: () => Promise<void>;
    showLocalNotification: (payload: NotificationPayload) => Promise<void>;
    /**
     * Eagerly-started promise: resolves when platform setup is done
     * (SW registration, Android channel) with initial local state.
     */
    initPromise: Promise<NotificationInitResult>;
};

let cachedAdapter: NotificationAdapter | undefined;

export function getNotificationAdapter(): NotificationAdapter {
    if (!cachedAdapter) {
        cachedAdapter = isTauri()
            ? createTauriNotificationAdapter()
            : createWebNotificationAdapter();
    }
    return cachedAdapter;
}
