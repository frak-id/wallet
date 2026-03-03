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

function getWebAdapter(): NotificationAdapter {
    return createWebNotificationAdapter();
}

function getTauriAdapter(): NotificationAdapter {
    return createTauriNotificationAdapter();
}

export function getNotificationAdapter(): NotificationAdapter {
    if (isTauri()) {
        return getTauriAdapter();
    }
    return getWebAdapter();
}
