import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import type {
    NotificationAdapter,
    NotificationInitResult,
    PushTokenPayload,
} from "./adapter";

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

function subscriptionToPayload(sub: PushSubscription): PushTokenPayload | null {
    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return null;
    return {
        type: "web-push" as const,
        subscription: {
            endpoint,
            keys: { p256dh, auth },
            expirationTime: json.expirationTime ?? undefined,
        },
    };
}

export function createWebNotificationAdapter(): NotificationAdapter {
    let subscription: PushSubscription | null | undefined;

    const initPromise: Promise<NotificationInitResult> = (async () => {
        if (
            typeof navigator === "undefined" ||
            !("serviceWorker" in navigator)
        ) {
            return { permissionGranted: false, localToken: null };
        }

        const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
        });
        const existingSubscription = hasPushManager(registration)
            ? await registration.pushManager.getSubscription()
            : null;
        subscription = existingSubscription;

        const permissionGranted =
            typeof Notification !== "undefined" &&
            Notification.permission === "granted";
        const localToken = existingSubscription
            ? subscriptionToPayload(existingSubscription)
            : null;

        return { permissionGranted, localToken };
    })();

    return {
        initPromise,

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
                throw new Error(
                    "Push notifications not supported: no service worker available"
                );
            }

            const registration = await navigator.serviceWorker.ready;
            if (!hasPushManager(registration)) {
                throw new Error(
                    "Push notifications not supported: PushManager unavailable"
                );
            }

            const createdSubscription =
                await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: process.env.VAPID_PUBLIC_KEY,
                });
            subscription = createdSubscription;

            const payload = subscriptionToPayload(createdSubscription);
            if (!payload) {
                throw new Error(
                    "Invalid push subscription: missing required fields"
                );
            }
            return payload;
        },

        unsubscribe: async () => {
            if (subscription) {
                await subscription.unsubscribe();
                subscription = undefined;
            }
        },

        showLocalNotification: async (_payload: NotificationPayload) => {},
    };
}
