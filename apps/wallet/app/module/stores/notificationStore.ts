import { create } from "zustand";

type NotificationState = {
    /**
     * Current push subscription object from the service worker
     * Used as in-memory cache to avoid repeated service worker queries
     */
    subscription: PushSubscription | undefined;
};

type NotificationActions = {
    /**
     * Set the current push subscription
     */
    setSubscription: (subscription: PushSubscription | undefined) => void;

    /**
     * Clear the subscription
     */
    clearSubscription: () => void;
};

export const notificationStore = create<
    NotificationState & NotificationActions
>()((set) => ({
    subscription: undefined,

    setSubscription: (subscription) => set({ subscription }),

    clearSubscription: () => set({ subscription: undefined }),
}));

/**
 * Selectors for notification state
 */
export const selectSubscription = (
    state: NotificationState & NotificationActions
) => state.subscription;
