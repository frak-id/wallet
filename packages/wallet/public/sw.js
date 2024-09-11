/*
 * Could switch to Serwist.js for build + additional features like caching (https://github.com/serwist/serwist)
 */

self.addEventListener("install", () => {
    console.info("service worker installed.");
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
    if (!(body && title)) {
        return;
    }

    // Rebuild the notification options
    const notificationOptions = {
        body,
        icon: icon || "/favicons/icon-192x192.png",
        ...additionalParams,
    };

    // todo: Store the notification
    //   - Could use indexedDb
    //   - Could use BroadcastChanel also? And broadcast chanel could also be great for app wide refresh (like wallet connection and stuff with iframe sdk)
    //   - Could use simple worker w/ post message

    // Display the notification
    event.waitUntil(
        self.registration.showNotification(title, notificationOptions)
    );
});

/**
 * Handle the click on a notification
 */
self.addEventListener("notificationclick", (event) => {
    // Close notification
    event.notification.close();

    // Get the url to open
    const url = event.notification.data?.url || "https://nexus.frak.id/";
    event.waitUntil(
        clients
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
                if (clients.openWindow) return clients.openWindow(url);
            })
    );
});
