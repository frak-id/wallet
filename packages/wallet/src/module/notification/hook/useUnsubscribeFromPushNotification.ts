"use client";
import { subscriptionAtom } from "@/module/notification/atom/subscriptionAtom";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";

/**
 * Unsubscribe from the push notification
 */
export function useUnsubscribeFromPushNotification() {
    const [subscription, setSubscription] = useAtom(subscriptionAtom);

    const { data: hasPushToken, refetch } = useQuery({
        queryKey: ["push", "token-count"],
        queryFn: async () => {
            const result =
                await backendApi.notifications.pushToken.hasAny.get();
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
        mutationKey: ["push", "unsubscribe"],
        mutationFn: async () => {
            // If we got a current subscription, unsubscribe from it
            if (subscription) {
                await subscription.unsubscribe();
                setSubscription(undefined);
            }

            // Remove every subscription related to this user
            await backendApi.notifications.pushToken.delete();

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
