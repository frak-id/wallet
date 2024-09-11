const SERVICE_WORKER_FILE_PATH = "./sw.js";
let pushManagerSubscription: PushSubscription;

export function notificationUnsupported(): boolean {
    let unsupported = false;
    if (
        !(
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "showNotification" in ServiceWorkerRegistration.prototype
        )
    ) {
        unsupported = true;
    }
    return unsupported;
}

export function checkPermissionStateAndAct(
    onSubscribe: (subs: PushSubscription | null) => void
): void {
    const state: NotificationPermission = Notification.permission;
    switch (state) {
        case "denied":
            break;
        case "granted":
            registerAndSubscribe(onSubscribe);
            break;
        case "default":
            break;
    }
}

export async function registerAndSubscribe(
    onSubscribe: (subs: PushSubscription | null) => void
): Promise<void> {
    try {
        await navigator.serviceWorker.register(SERVICE_WORKER_FILE_PATH);
        await subscribe(onSubscribe);
    } catch (e) {
        console.error("Failed to register service-worker: ", e);
    }
}

async function subscribe(
    onSubscribe: (subs: PushSubscription | null) => void
): Promise<void> {
    navigator.serviceWorker.ready
        .then((registration: ServiceWorkerRegistration) => {
            return registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.VAPID_PUBLIC_KEY,
            });
        })
        .then((subscription: PushSubscription) => {
            console.info(
                "Created subscription Object: ",
                subscription.toJSON()
            );
            pushManagerSubscription = subscription;
            onSubscribe(subscription);
        })
        .catch((e) => {
            console.error("Failed to subscribe cause of: ", e);
        });
}

export async function sendWebPush(message: string | null): Promise<void> {
    const endPointUrl = "/api/web-push/send";
    const pushBody = {
        title: "Test Push",
        body: message ?? "This is a test push message",
        image: "/next.png",
        icon: "nextjs.png",
        url: "https://google.com",
    };
    console.log("pushBody", JSON.stringify(pushBody));
    const res = await fetch(endPointUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            subscription: pushManagerSubscription,
            payload: pushBody,
        }),
    });
    const result = await res.json();
    navigator.setAppBadge && (await navigator.setAppBadge(1));
    console.log("sendWebPush", result);
}
