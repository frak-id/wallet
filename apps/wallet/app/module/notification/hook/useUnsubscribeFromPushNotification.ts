import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { subscriptionAtom } from "@/module/notification/atom/subscriptionAtom";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";

/**
 * Unsubscribe from the push notification
 */
export function useUnsubscribeFromPushNotification() {
    const [subscription, setSubscription] = useAtom(subscriptionAtom);

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
                setSubscription(undefined);
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
