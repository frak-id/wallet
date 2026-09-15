import { notificationStorage } from "@/module/notification/storage/notifications";

declare const self: ServiceWorkerGlobalScope;

/**
 * Auto claims all clients
 */
self.addEventListener("activate", (event) =>
    event.waitUntil(self.clients.claim())
);

/**
 * Log a few stuff on install
 */
self.addEventListener("install", (event) => {
    console.log("Service worker installed", event);
    event.waitUntil(self.skipWaiting());
});

/**
 * Handle a new push message
 */
self.addEventListener("push", (event) => {
    if (!event.data) {
        return;
    }

    // Parse the push message
    const payload = event.data.json();
    const { title, body, icon, ...additionalParams } = payload;

    // Ensure a few mandatory fields are present
    if (!body || !title) {
        return;
    }

    // Rebuild the notification options
    const notificationOptions = {
        body,
        icon: icon || "/icon-192.png",
        ...additionalParams,
    };

    // Save the notification in IndexedDB
    const notificationId = `${Date.now()}-${JSON.stringify(payload)}`;
    const insertToDbPromise = notificationStorage
        .add({
            id: notificationId,
            title,
            timestamp: Date.now(),
            ...notificationOptions,
        })
        .catch((error) => {
            console.error("Error while saving the notification", error);
        });

    // Display notification promise
    const displayNotificationPromise = self.registration.showNotification(
        title,
        notificationOptions
    );

    // Display the notification
    event.waitUntil(
        Promise.all([displayNotificationPromise, insertToDbPromise])
    );
});

/**
 * Focus a client without letting a rejected `focus()` abort the caller.
 *
 * `focus()` rejects when the UA considers the notification's user activation
 * spent; that must degrade to "try something else", not kill the handler.
 */
function focusQuietly(client: WindowClient): Promise<boolean> {
    return client.focus().then(
        () => true,
        () => false
    );
}

/**
 * Reuse an already-open wallet tab for a notification target, if there is one.
 *
 * `WindowClient.url` is always an absolute URL, so the previous
 * `client.url === "/"` check could never be true: every notification click fell
 * through to `openWindow`, paying a full cold start (bundle, wagmi +
 * smart-wallet init, query hydration) and stacking a duplicate tab each time.
 *
 * Returns `true` once the notification has been served, so the caller knows not
 * to open a new window. Returning `false` must always remain safe: the caller
 * falls back to `openWindow`, which is what guarantees a deep link is never
 * silently dropped.
 */
async function focusExistingClient(
    clientList: readonly WindowClient[],
    targetUrl: URL
): Promise<boolean> {
    // A bare "/" is the backend's default payload (it has no deep link to
    // offer), and the app redirects "/" to "/wallet" anyway. Navigating for it
    // would tear down a live SPA — losing an open modal or a half-filled send
    // form — to land the user where they already are.
    const isGenericTarget = targetUrl.pathname === "/";

    for (const client of clientList) {
        if (new URL(client.url).origin !== targetUrl.origin) continue;

        // No specific destination, or the tab is already there: just focus.
        if (isGenericTarget || client.url === targetUrl.href) {
            if (await focusQuietly(client)) return true;
            continue;
        }

        // Deep link: this tab has to actually end up on the target. `navigate`
        // rejects when the client is not controlled by this worker.
        const navigated = await client
            .navigate(targetUrl.href)
            .catch(() => null);
        if (!navigated) {
            // Do not settle for focusing a tab showing something else — that
            // would drop the deep link. Let `openWindow` serve it instead.
            continue;
        }

        // The destination is now loaded. Focus is best-effort from here: even
        // if it fails, re-navigating another tab would be worse.
        await focusQuietly(navigated);
        return true;
    }

    return false;
}

/**
 * Handle the click on a notification
 */
self.addEventListener("notificationclick", (event) => {
    // Close notification
    event.notification.close();

    // Get the url to open. Default falls back to the build-time wallet URL
    // (prod build → wallet.frak.id, dev build → wallet-dev.frak.id) so the
    // dev variant never sends users to the prod domain.
    const fallbackUrl = `${process.env.FRAK_WALLET_URL}/`;
    let targetUrl: URL;
    try {
        targetUrl = new URL(
            event.notification.data?.url || fallbackUrl,
            self.location.origin
        );
    } catch {
        // A malformed payload must not throw out of the handler: that would
        // leave the click doing nothing at all.
        targetUrl = new URL(fallbackUrl, self.location.origin);
    }
    event.waitUntil(
        self.clients
            .matchAll({
                type: "window",
            })
            .then(async (clientList) => {
                if (await focusExistingClient(clientList, targetUrl)) return;

                // Otherwise, open the target url
                if (self.clients.openWindow)
                    return self.clients.openWindow(targetUrl.href);
            })
    );
});
