import { authenticatedBackendApi } from "@/module/common/api/backendClient";
import { subscriptionAtom } from "@/module/notification/atom/subscriptionAtom";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { notificationKey } from "@/module/notification/queryKeys/notification";
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
        mutationKey: notificationKey.push.subscribe,
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

            // Save this new subscription
            const jsonSubscription = subscription.toJSON();
            await authenticatedBackendApi.notifications.pushToken.put({
                subscription: {
                    endpoint: jsonSubscription.endpoint ?? "no-endpoint",
                    keys: {
                        p256dh: jsonSubscription.keys?.p256dh ?? "no-p256",
                        auth: jsonSubscription.keys?.auth ?? "no-auth",
                    },
                    expirationTime:
                        jsonSubscription.expirationTime ?? undefined,
                },
            });
        },
    });

    return { subscribeToPush, subscribeToPushAsync, ...mutationState };
}
