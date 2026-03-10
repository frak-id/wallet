import { useMutation, useQuery } from "@tanstack/react-query";
import { useNotificationContext } from "@/module/notification/context/NotificationContext";
import { notificationKey } from "@/module/notification/queryKeys/notification";

/**
 * Unsubscribe from the push notification
 */
export function useUnsubscribeFromPushNotification() {
    const { adapter, setIsSubscribed } = useNotificationContext();

    const { data: hasPushToken, refetch } = useQuery({
        queryKey: notificationKey.push.tokenCount,
        queryFn: async () => {
            return await adapter.isSubscribed();
        },
    });

    /**
     * Mutation used to subscribe to the push notification
     */
    const {
        mutate: unsubscribeFromPush,
        mutateAsync: unsubscribeFromPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: notificationKey.push.unsubscribe,
        mutationFn: async () => {
            await adapter.unsubscribe();
            setIsSubscribed(false);
            await refetch();
        },
    });

    return {
        hasPushToken,
        unsubscribeFromPush,
        unsubscribeFromPushAsync,
        ...mutationState,
    };
}
