"use client";
import { unsubscribeFromPush as unsubAction } from "@/context/notification/action/unsubscribe";
import { subscriptionAtom } from "@/module/notification/atom/subscriptionAtom";
import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";

/**
 * Unsubscribe from the push notification
 */
export function useUnsubscribeFromPushNotification() {
    const [subscription, setSubscription] = useAtom(subscriptionAtom);

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
            await unsubAction();
        },
    });

    return { unsubscribeFromPush, unsubscribeFromPushAsync, ...mutationState };
}
