import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { createTauriNotificationAdapter } from "./tauriAdapter";
import { createWebNotificationAdapter } from "./webAdapter";

export type NotificationAdapter = {
    isSupported: () => boolean;
    getPermissionStatus: () => NotificationPermission;
    requestPermission: () => Promise<NotificationPermission>;
    subscribe: () => Promise<void>;
    unsubscribe: () => Promise<void>;
    isSubscribed: () => Promise<boolean>;
    initialize: () => Promise<{ isSubscribed: boolean }>;
    showLocalNotification: (payload: NotificationPayload) => Promise<void>;
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
