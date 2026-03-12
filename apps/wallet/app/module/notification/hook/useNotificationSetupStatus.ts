import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useNotificationContext } from "@/module/notification/context/NotificationContext";
import { notificationKey } from "@/module/notification/queryKeys/notification";

/**
 * Get the notification setup status
 */
export function useNotificationSetupStatus() {
    const {
        adapter,
        isSubscribed: initialSubscribedState,
        isInitialized,
    } = useNotificationContext();

    /**
     * Ask for the permissions to display notification
     */
    const askForNotificationPermission = useCallback(async () => {
        try {
            await adapter.requestPermission();
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

    // Gate on isInitialized to prevent a race on web/PWA: the fire-and-forget
    // backend sync in webAdapter.initialize() may not have completed when
    // adapter.isSubscribed() (backend hasAny) runs, returning a false negative
    // that overwrites the correct local-subscription-based state.
    // SetupNotifications seeds the cache before setting isInitialized=true,
    // so the query starts with authoritative data and won't refetch until
    // staleTime (60s), giving the sync time to land.
    const { data: isSubscribed } = useQuery({
        queryKey: notificationKey.push.tokenCount,
        queryFn: async () => {
            return await adapter.isSubscribed();
        },
        enabled: isSupported && isInitialized,
        initialData: initialSubscribedState,
    });

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
