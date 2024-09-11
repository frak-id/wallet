"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

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
            await refetch();
        } catch (e) {
            console.error("Failed to request notification permission: ", e);
        }
    }, []);

    /**
     * Check if notification are supported or not
     */
    const isSupported = useMemo(() => {
        return (
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "showNotification" in ServiceWorkerRegistration.prototype
        );
    }, []);

    /**
     * Fetch the status
     */
    const { data, refetch } = useQuery({
        queryKey: ["push", "setup-status", `isSupported-${isSupported}`],
        queryFn: () => {
            if (!isSupported) {
                return { isSupported };
            }

            const notificationPermission = Notification.permission;
            const isNotificationAllowed = notificationPermission === "granted";
            return { isSupported, isNotificationAllowed };
        },
    });

    return useMemo(() => {
        if (!data?.isSupported) {
            return { isSupported: false };
        }

        return {
            isSupported: true,
            isNotificationAllowed: data.isNotificationAllowed,
            askForNotificationPermission,
        };
    }, [data, askForNotificationPermission]);
}
