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

export type NotificationAdapterEventMap = {
    "token-update": CustomEvent<PushTokenPayload>;
};

export type NotificationAdapter = {
    initPromise: Promise<void>;
    getPermissionStatus: () => Promise<NotificationPermissionStatus>;
    requestPermission: () => Promise<NotificationPermissionStatus>;
    getToken: () => Promise<PushTokenPayload | null>;
    subscribe: () => Promise<PushTokenPayload>;
    unsubscribe: () => Promise<void>;
    openSettings: () => Promise<void>;
    events: EventTarget;
};

export const notificationAdapter: NotificationAdapter = isTauri()
    ? createTauriNotificationAdapter()
    : createWebNotificationAdapter();
