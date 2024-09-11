import { dexieDb } from "@/context/common/dexie/dexieDb";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { keccak256, toHex } from "viem";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * We are using Serwist mainly for the clean typescript transpilation
 *   Maybe we could exploit some of the preloading features??
 */
const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: false,
    // todo: env specific stuff
    disableDevLogs: false,
});

self.addEventListener("install", serwist.handleInstall);

self.addEventListener("activate", (event) => serwist.handleActivate(event));

self.addEventListener("fetch", (event) => serwist.handleFetch(event));

self.addEventListener("message", serwist.handleCache);

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

    // Save the notification in our database
    const notificationDb = dexieDb.notification;
    const notificationId = keccak256(
        toHex(`${Date.now()}-${JSON.stringify(payload)}`)
    );
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
    const url = event.notification.data?.url || "https://nexus.frak.id/";
    event.waitUntil(
        // @ts-ignore
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
