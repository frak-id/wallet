import { useCallback, useMemo } from "react";
import {
    notificationStore,
    selectSubscription,
} from "@/module/stores/notificationStore";

/**
 * Get the notification setup status
 */
export function useNotificationSetupStatus() {
    /**
     * Ask for the permissions to display notification
     */
    const askForNotificationPermission = useCallback(async () => {
        try {
            const result = await Notification.requestPermission();
            console.log("Notification permission: ", result);
        } catch (e) {
            console.error("Failed to request notification permission: ", e);
        }
    }, []);

    /**
     * Check if notification are supported or not
     */
    const isSupported = useMemo(() => {
        if (typeof window === "undefined" || typeof navigator === "undefined") {
            return false;
        }
        return (
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "showNotification" in ServiceWorkerRegistration.prototype
        );
    }, []);

    /**
     * Fetch the status
     */
    const statusResult = useMemo(() => {
        if (!isSupported) {
            return { isSupported, isNotificationAllowed: false };
        }

        const notificationPermission = Notification.permission;
        const isNotificationAllowed = notificationPermission === "granted";
        return { isSupported, isNotificationAllowed };
    }, [isSupported]);

    /**
     * The current subscription from the store
     */
    const subscription = notificationStore(selectSubscription);

    return useMemo(() => {
        if (!statusResult?.isSupported) {
            return { isSupported: false };
        }

        return {
            isSupported: true,
            isNotificationAllowed: statusResult.isNotificationAllowed,
            askForNotificationPermission,
            subscription,
        };
    }, [statusResult, subscription, askForNotificationPermission]);
}
