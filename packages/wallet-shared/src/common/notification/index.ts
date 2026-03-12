export type {
    NotificationAdapter,
    NotificationPermissionStatus,
    PushTokenPayload,
} from "./adapter";
export { notificationAdapter } from "./adapter";
export { createTauriNotificationAdapter } from "./tauriAdapter";
export { createWebNotificationAdapter } from "./webAdapter";
