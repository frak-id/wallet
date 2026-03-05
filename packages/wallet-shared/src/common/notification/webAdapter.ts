import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { authenticatedWalletApi } from "../api/backendClient";
import type { NotificationAdapter } from "./adapter";

type PushRegistration = {
    pushManager: PushManager;
};

function hasPushManager(
    registration: unknown
): registration is PushRegistration {
    return (
        typeof registration === "object" &&
        registration !== null &&
        "pushManager" in registration
    );
}

export function createWebNotificationAdapter(): NotificationAdapter {
    let subscription: PushSubscription | null | undefined;
    const syncSubscriptionToBackend = async (sub: PushSubscription) => {
        const jsonSubscription = sub.toJSON();
        const endpoint = jsonSubscription.endpoint;
        const p256dh = jsonSubscription.keys?.p256dh;
        const auth = jsonSubscription.keys?.auth;
        if (!endpoint || !p256dh || !auth) {
            console.warn("Invalid push subscription: missing required fields");
            return;
        }
        await authenticatedWalletApi.notifications.tokens.put({
            type: "web-push" as const,
            subscription: {
                endpoint,
                keys: { p256dh, auth },
                expirationTime: jsonSubscription.expirationTime ?? undefined,
            },
        });
    };

    return {
        isSupported: () => {
            if (
                typeof window === "undefined" ||
                typeof navigator === "undefined"
            ) {
                return false;
            }
            return (
                "serviceWorker" in navigator &&
                "PushManager" in window &&
                "showNotification" in ServiceWorkerRegistration.prototype
            );
        },
        getPermissionStatus: () => {
            if (typeof Notification === "undefined") {
                return "default";
            }
            return Notification.permission;
        },
        requestPermission: async () => {
            if (typeof Notification === "undefined") {
                return "default";
            }
            return await Notification.requestPermission();
        },
        subscribe: async () => {
            if (
                typeof navigator === "undefined" ||
                !("serviceWorker" in navigator)
            ) {
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            if (!hasPushManager(registration)) {
                return;
            }

            const createdSubscription =
                await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: process.env.VAPID_PUBLIC_KEY,
                });
            subscription = createdSubscription;

            await syncSubscriptionToBackend(createdSubscription);
        },
        unsubscribe: async () => {
            if (subscription) {
                await subscription.unsubscribe();
                subscription = undefined;
            }

            await authenticatedWalletApi.notifications.tokens.delete();
        },
        isSubscribed: async () => {
            const result =
                await authenticatedWalletApi.notifications.tokens.hasAny.get();
            return result.data ?? false;
        },
        initialize: async () => {
            if (
                typeof navigator === "undefined" ||
                !("serviceWorker" in navigator)
            ) {
                return { isSubscribed: false };
            }

            const registration = await navigator.serviceWorker.register(
                "/sw.js",
                {
                    scope: "/",
                    updateViaCache: "none",
                }
            );
            const existingSubscription = hasPushManager(registration)
                ? await registration.pushManager.getSubscription()
                : undefined;
            subscription = existingSubscription;

            if (existingSubscription) {
                syncSubscriptionToBackend(existingSubscription).catch(
                    (error) => {
                        console.warn(
                            "Failed to sync subscription to backend",
                            error
                        );
                    }
                );
            }

            return {
                isSubscribed:
                    subscription !== null && subscription !== undefined,
            };
        },
        showLocalNotification: async (_payload: NotificationPayload) => {},
    };
}
