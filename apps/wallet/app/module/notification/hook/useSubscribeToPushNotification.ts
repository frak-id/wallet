import {
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { useNotificationContext } from "@/module/notification/context/NotificationContext";
import { notificationKey } from "@/module/notification/queryKeys/notification";

/**
 * Register the push notification handler
 */
export function useSubscribeToPushNotification(
    mutationOptions?: UseMutationOptions
) {
    const { adapter, setIsSubscribed } = useNotificationContext();
    const queryClient = useQueryClient();

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
            // Sync the shared query cache so EnableNotification and
            // RemoveAllNotification both reflect the new state immediately
            queryClient.setQueryData(
                notificationKey.push.tokenCount,
                subscribed
            );
        },
        onError: (error, variables, onMutateResult, context) => {
            console.error("[Notification] subscribe failed:", error);
            mutationOptions?.onError?.(
                error,
                variables,
                onMutateResult,
                context
            );
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}
