import { authenticatedWalletApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import {
    notificationStore,
    selectSubscription,
} from "@/module/stores/notificationStore";

/**
 * Unsubscribe from the push notification
 */
export function useUnsubscribeFromPushNotification() {
    const subscription = notificationStore(selectSubscription);

    const { data: hasPushToken, refetch } = useQuery({
        queryKey: notificationKey.push.tokenCount,
        queryFn: async () => {
            const result =
                await authenticatedWalletApi.notifications.tokens.hasAny.get();
            return result.data ?? false;
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
            // If we got a current subscription, unsubscribe from it
            if (subscription) {
                await subscription.unsubscribe();
                notificationStore.getState().clearSubscription();
            }

            // Remove every subscription related to this user
            await authenticatedWalletApi.notifications.tokens.delete();

            // Refetch the push token count
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
