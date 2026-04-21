/**
 * Notification opt-in event map — covers the register-flow notification step.
 *
 * Two events:
 *   - `notification_opt_in_viewed` — user landed on the notification step
 *   - `notification_opt_in_resolved` — step terminated, `outcome` says how
 *
 * `outcome` unifies what used to be 5 separate events (enabled, skipped,
 * denied, auto_skipped with granted/denied). Dashboards filter by outcome
 * instead of joining multiple event streams. Shares the `onboarding` flow_id
 * when fired inside the register flow.
 */
export type NotificationOptInOutcome =
    | "enabled"
    | "skipped"
    | "denied"
    | "auto_skipped_granted"
    | "auto_skipped_denied";

type NotificationBaseProps = {
    flow_id?: string;
};

export type NotificationEventMap = {
    notification_opt_in_viewed: NotificationBaseProps | undefined;
    notification_opt_in_resolved: NotificationBaseProps & {
        outcome: NotificationOptInOutcome;
        reason?: string;
    };
};
