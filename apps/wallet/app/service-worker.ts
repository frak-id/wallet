import { dexieDb } from "@/module/common/storage/dexie/dexieDb";

declare const self: ServiceWorkerGlobalScope;

/*
 * todo: Dexi is fat af in when compiled, find a lighter way, should be under 200kb (and now it's at 701kb)
 */

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

    // Save the notification in our database
    const notificationDb = dexieDb.notification;
    const notificationId = `${Date.now()}-${JSON.stringify(payload)}`;
    const insertToDbPromise = notificationDb
        .put({
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
 * Handle the click on a notification
 */
self.addEventListener("notificationclick", (event) => {
    // Close notification
    event.notification.close();

    // Get the url to open
    const url = event.notification.data?.url || "https://wallet.frak.id/";
    event.waitUntil(
        // @ts-expect-error
        self.clients
            .matchAll({
                type: "window",
            })
            .then((clientList) => {
                // If we got a client on our domain, focus it
                for (const client of clientList) {
                    console.log("Checking client", client);
                    if (client.url === "/" && "focus" in client)
                        return client.focus();
                }

                // Otherwise, open the target url
                if (self.clients.openWindow)
                    return self.clients.openWindow(url);
            })
    );
});
