import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Local "user opted out" flag for push notifications.
 *
 * Source of truth for whether the user explicitly disabled the in-app
 * notification toggle. Persisted so it survives app restarts.
 *
 * Why it exists: on iOS the OS permission stays granted after the user
 * toggles the in-app switch off (only the FCM token is deleted). Without
 * this flag, the adapter's lazy `fcm.register()` and the backend re-PUT
 * reconciliation in `useNotificationStatus` would silently re-subscribe
 * the user on the next render cycle, flipping the switch back on.
 *
 * Set `true` when the user runs unsubscribe.
 * Set `false` when the user runs subscribe.
 */
type NotificationOptOutState = {
    optedOut: boolean;
};

type NotificationOptOutActions = {
    setOptedOut: (optedOut: boolean) => void;
};

export const notificationOptOutStore = create<
    NotificationOptOutState & NotificationOptOutActions
>()(
    persist(
        (set) => ({
            optedOut: false,
            setOptedOut: (optedOut) => set({ optedOut }),
        }),
        {
            name: "frak_notification_opt_out",
            partialize: (state) => ({ optedOut: state.optedOut }),
        }
    )
);

export const selectOptedOut = (state: NotificationOptOutState) =>
    state.optedOut;
