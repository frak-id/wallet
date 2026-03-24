import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type {
    NotificationAdapter,
    NotificationPermissionStatus,
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

function mapWebPermission(
    permission: NotificationPermission
): NotificationPermissionStatus {
    if (permission === "granted") return "granted";
    if (permission === "denied") return "denied";
    return "prompt";
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
    let registration: ServiceWorkerRegistration | undefined;

    const initPromise: Promise<void> = (async () => {
        if (
            typeof navigator === "undefined" ||
            !("serviceWorker" in navigator) ||
            isTauri()
        ) {
            return;
        }

        registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
        });
    })();

    return {
        initPromise,

        getPermissionStatus: async () => {
            if (typeof Notification === "undefined") {
                return "prompt";
            }
            return mapWebPermission(Notification.permission);
        },

        requestPermission: async () => {
            if (typeof Notification === "undefined") {
                return "prompt";
            }
            const result = await Notification.requestPermission();
            return mapWebPermission(result);
        },

        getToken: async () => {
            await initPromise;
            if (!registration || !hasPushManager(registration)) {
                return null;
            }
            const sub = await registration.pushManager.getSubscription();
            return sub ? subscriptionToPayload(sub) : null;
        },

        subscribe: async () => {
            await initPromise;
            if (
                typeof navigator === "undefined" ||
                !("serviceWorker" in navigator)
            ) {
                throw new Error(
                    "Push notifications not supported: no service worker available"
                );
            }

            const reg = await navigator.serviceWorker.ready;
            if (!hasPushManager(reg)) {
                throw new Error(
                    "Push notifications not supported: PushManager unavailable"
                );
            }

            const createdSubscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.VAPID_PUBLIC_KEY,
            });

            const payload = subscriptionToPayload(createdSubscription);
            if (!payload) {
                throw new Error(
                    "Invalid push subscription: missing required fields"
                );
            }
            return payload;
        },

        unsubscribe: async () => {
            await initPromise;
            if (!registration || !hasPushManager(registration)) {
                return;
            }
            const sub = await registration.pushManager.getSubscription();
            if (sub) {
                await sub.unsubscribe();
            }
        },

        openSettings: async () => {
            // No-op on web: browsers handle notification permission via their own UI
        },

        events: new EventTarget(),
    };
}
