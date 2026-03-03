import { useCallback, useMemo } from "react";
import { useNotificationContext } from "@/module/notification/context/NotificationContext";

/**
 * Get the notification setup status
 */
export function useNotificationSetupStatus() {
    const { adapter, isSubscribed } = useNotificationContext();

    /**
     * Ask for the permissions to display notification
     */
    const askForNotificationPermission = useCallback(async () => {
        try {
            const result = await adapter.requestPermission();
            console.log("Notification permission: ", result);
        } catch (e) {
            console.error("Failed to request notification permission: ", e);
        }
    }, [adapter]);

    /**
     * Check if notification are supported or not
     */
    const isSupported = useMemo(() => {
        return adapter.isSupported();
    }, [adapter]);

    /**
     * Fetch the status
     */
    const statusResult = useMemo(() => {
        if (!isSupported) {
            return { isSupported, isNotificationAllowed: false };
        }

        const permissionStatus = adapter.getPermissionStatus();
        const isNotificationAllowed = permissionStatus === "granted";
        return { isSupported, isNotificationAllowed };
    }, [isSupported, adapter]);

    return useMemo(() => {
        if (!statusResult?.isSupported) {
            return { isSupported: false };
        }

        return {
            isSupported: true,
            isNotificationAllowed: statusResult.isNotificationAllowed,
            askForNotificationPermission,
            isSubscribed,
        };
    }, [statusResult, isSubscribed, askForNotificationPermission]);
}
