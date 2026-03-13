import type { NotificationModel } from "./storage/NotificationModel";

export function createMockNotification(
    overrides?: Partial<NotificationModel>
): NotificationModel {
    return {
        id: `notif-${Date.now()}`,
        title: "Test Notification",
        body: "Test notification body",
        timestamp: Date.now(),
        ...overrides,
    };
}
