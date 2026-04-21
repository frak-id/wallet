/**
 * Notification opt-in event map — covers the register-flow notification step
 * plus the ambient permission resolution that runs on every mount.
 *
 * These events share the `onboarding` flow id when fired inside the register
 * flow (the notification step is a sub-step of onboarding).
 */
export type NotificationPermission = "granted" | "denied" | "default";

type NotificationBaseProps = {
    flow_id?: string;
};

export type NotificationEventMap = {
    notification_opt_in_viewed: NotificationBaseProps | undefined;
    notification_opt_in_enabled: NotificationBaseProps | undefined;
    notification_opt_in_skipped: NotificationBaseProps | undefined;
    notification_opt_in_denied: NotificationBaseProps & {
        reason: string;
    };
    notification_permission_resolved: NotificationBaseProps & {
        permission: NotificationPermission;
    };
    notification_auto_skipped: NotificationBaseProps & {
        reason: "already_granted" | "already_denied";
    };
};
