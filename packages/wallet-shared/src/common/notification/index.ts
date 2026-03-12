export type {
    NotificationAdapter,
    NotificationInitResult,
    PushTokenPayload,
} from "./adapter";
export { getNotificationAdapter } from "./adapter";
export { createTauriNotificationAdapter } from "./tauriAdapter";
export { createWebNotificationAdapter } from "./webAdapter";
