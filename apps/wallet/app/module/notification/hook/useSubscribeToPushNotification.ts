import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { useNotificationContext } from "@/module/notification/context/NotificationContext";
import { notificationKey } from "@/module/notification/queryKeys/notification";

/**
 * Register the push notification handler
 */
export function useSubscribeToPushNotification(
    mutationOptions?: MutationOptions
) {
    const { adapter, setIsSubscribed } = useNotificationContext();

    /**
     * Mutation used to subscribe to the push notification
     */
    const {
        mutate: subscribeToPush,
        mutateAsync: subscribeToPushAsync,
        ...mutationState
    } = useMutation({
        ...mutationOptions,
        mutationKey: notificationKey.push.subscribe,
        mutationFn: async () => {
            await adapter.subscribe();
            const subscribed = await adapter.isSubscribed();
            setIsSubscribed(subscribed);
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}
