import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";

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
    return {
        isSupported: () => false,
        getPermissionStatus: () => "denied" as NotificationPermission,
        requestPermission: async () => "denied" as NotificationPermission,
        subscribe: async () => {},
        unsubscribe: async () => {},
        isSubscribed: async () => false,
        initialize: async () => ({ isSubscribed: false }),
        showLocalNotification: async () => {},
    };
}

function getTauriAdapter(): NotificationAdapter {
    return {
        isSupported: () => true,
        getPermissionStatus: () => "granted" as NotificationPermission,
        requestPermission: async () => "granted" as NotificationPermission,
        subscribe: async () => {},
        unsubscribe: async () => {},
        isSubscribed: async () => true,
        initialize: async () => ({ isSubscribed: true }),
        showLocalNotification: async () => {},
    };
}

export function getNotificationAdapter(): NotificationAdapter {
    if (isTauri()) {
        return getTauriAdapter();
    }
    return getWebAdapter();
}
