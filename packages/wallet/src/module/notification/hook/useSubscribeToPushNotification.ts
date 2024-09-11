"use client";

import { savePushToken } from "@/context/notification/action/save";
import { subscriptionAtom } from "@/module/notification/atom/subscriptionAtom";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

/**
 * Register the push notification handler
 */
export function useSubscribeToPushNotification() {
    const { isSupported } = useNotificationSetupStatus();
    const setSubscription = useSetAtom(subscriptionAtom);

    /**
     * Hook to automatically register the service worker if possible
     */
    useEffect(() => {
        if (!isSupported) {
            console.log("Push service not supported on this browser");
            return;
        }
        // Launch the service worker registration automatically if possible
        registerServiceWorker();
    }, [isSupported]);

    /**
     * Mutation used to register the service worker
     */
    const { mutate: registerServiceWorker } = useMutation({
        mutationKey: ["push", "register-service-worker"],
        mutationFn: async () => {
            // Ask the navigator to register the service worker
            const registration = await navigator.serviceWorker.register(
                "./sw.js",
                {
                    scope: "/",
                    updateViaCache: "none",
                }
            );
            // Get potential subscription already present in the service worker
            const subscription =
                await registration.pushManager.getSubscription();
            if (!subscription) {
                console.log(
                    "No previous subscription found on this service worker"
                );
                return;
            }
            setSubscription(subscription);
            // Save this new subscription
            await savePushToken({ subscription: subscription.toJSON() });
        },
    });

    /**
     * Mutation used to subscribe to the push notification
     */
    const {
        mutate: subscribeToPush,
        mutateAsync: subscribeToPushAsync,
        ...mutationState
    } = useMutation({
        mutationKey: ["push", "subscribe"],
        mutationFn: async () => {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.VAPID_PUBLIC_KEY,
            });
            setSubscription(subscription);
            await savePushToken({ subscription: subscription.toJSON() });
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}
