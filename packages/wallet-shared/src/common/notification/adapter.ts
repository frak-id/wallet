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

/**
 * Rich permission status that preserves Android's "prompt-with-rationale" state.
 *
 * - `"granted"` — permission active
 * - `"denied"` — permanently denied (must open OS settings to recover)
 * - `"prompt"` — never asked yet (or auto-granted on Android ≤12)
 * - `"prompt-with-rationale"` — Android only: user denied once, show rationale before asking again
 */
export type NotificationPermissionStatus =
    | "granted"
    | "denied"
    | "prompt"
    | "prompt-with-rationale";

export type NotificationAdapter = {
    initPromise: Promise<void>;
    getPermissionStatus: () => Promise<NotificationPermissionStatus>;
    requestPermission: () => Promise<NotificationPermissionStatus>;
    getToken: () => Promise<PushTokenPayload | null>;
    subscribe: () => Promise<PushTokenPayload>;
    unsubscribe: () => Promise<void>;
    /**
     * Open the OS app notification settings page.
     * On web, this is a no-op (browser handles its own permission UI).
     */
    openSettings: () => Promise<void>;
};

export const notificationAdapter: NotificationAdapter = isTauri()
    ? createTauriNotificationAdapter()
    : createWebNotificationAdapter();
