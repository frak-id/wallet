"use client";

import { savePushToken } from "@/context/notification/action/save";
import { subscriptionAtom } from "@/module/notification/atom/subscriptionAtom";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { type MutationOptions, useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

/**
 * Register the push notification handler
 */
export function useSubscribeToPushNotification(
    mutationOptions?: MutationOptions
) {
    const { isNotificationAllowed, askForNotificationPermission } =
        useNotificationSetupStatus();

    const setSubscription = useSetAtom(subscriptionAtom);

    /**
     * Mutation used to subscribe to the push notification
     */
    const {
        mutate: subscribeToPush,
        mutateAsync: subscribeToPushAsync,
        ...mutationState
    } = useMutation({
        ...mutationOptions,
        mutationKey: ["push", "subscribe"],
        mutationFn: async () => {
            // If notification are not allowed, ask for permission
            if (!isNotificationAllowed && askForNotificationPermission) {
                console.log("Asking for notification permission");
                await askForNotificationPermission();
            }

            // Perform the subscription registration
            console.log("Waiting for service worker registration");
            const registration = await navigator.serviceWorker.ready;
            console.log(
                "Service worker registered, subscribing to push notification"
            );
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.VAPID_PUBLIC_KEY,
            });
            console.info(
                "Created subscription Object: ",
                subscription.toJSON()
            );
            setSubscription(subscription);
            await savePushToken({ subscription: subscription.toJSON() });
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}
