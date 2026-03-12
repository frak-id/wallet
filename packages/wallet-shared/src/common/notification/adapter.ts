import { isTauri } from "@frak-labs/app-essentials/utils/platform";
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

export type NotificationAdapter = {
    initPromise: Promise<void>;
    getPermissionStatus: () => Promise<NotificationPermission>;
    requestPermission: () => Promise<NotificationPermission>;
    getToken: () => Promise<PushTokenPayload | null>;
    subscribe: () => Promise<PushTokenPayload>;
    unsubscribe: () => Promise<void>;
};

export const notificationAdapter: NotificationAdapter = isTauri()
    ? createTauriNotificationAdapter()
    : createWebNotificationAdapter();
