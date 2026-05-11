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
    | "auto_skipped_denied"
    | "settings_subscribed"
    | "settings_unsubscribed"
    | "settings_blocked"
    | "settings_failed"
    | "settings_opened";

/**
 * Phases emitted by the wallet settings notification toggle. Used to debug
 * native opt-in flows on real devices, where local logs aren't available.
 * One event per phase keeps the OpenPanel timeline linear and easy to scrub.
 *
 * iOS deny→Settings→grant recovery happens transparently inside the FCM
 * adapter (lazy `fcm.register()` on next `getToken`), so no resubscribe
 * phases are emitted from the React layer.
 */
export type NotificationTogglePhase =
    | "tap"
    | "unsubscribe_start"
    | "unsubscribe_done"
    | "unsubscribe_failed"
    | "open_settings_start"
    | "open_settings_done"
    | "open_settings_failed"
    | "subscribe_start"
    | "subscribe_done"
    | "subscribe_failed";

type NotificationBaseProps = {
    flow_id?: string;
};

export type NotificationEventMap = {
    notification_opt_in_viewed: NotificationBaseProps | undefined;
    notification_opt_in_resolved: NotificationBaseProps & {
        outcome: NotificationOptInOutcome;
        reason?: string;
    };
    notification_toggle_phase: {
        phase: NotificationTogglePhase;
        permission?: "granted" | "denied" | "prompt" | "prompt-with-rationale";
        checked?: boolean;
        has_local_capability?: boolean;
        reason?: string;
    };
};
