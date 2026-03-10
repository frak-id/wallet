import { isAndroid, isIOS } from "@frak-labs/app-essentials/utils/platform";
import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { addPluginListener } from "@tauri-apps/api/core";
import { authenticatedWalletApi } from "../api/backendClient";
import { notificationStorage } from "../storage/notifications";
import type { NotificationAdapter } from "./adapter";

// Augment Window for the FCM token set by native Swift code (FirebaseManager.swift).
// On iOS, FirebaseManager evaluates JavaScript to set this global and dispatch a custom event.
declare global {
    interface Window {
        __frakFcmToken?: string;
    }
    interface WindowEventMap {
        "frak:fcm-token": CustomEvent<{ token: string }>;
    }
}

async function getTauriNotificationPlugin() {
    try {
        return await import("@choochmeque/tauri-plugin-notifications-api");
    } catch {
        return undefined;
    }
}

/**
 * Race a promise against a timeout. Rejects with a descriptive error if the
 * promise doesn't settle within `ms` milliseconds.
 *
 * Primary use: guard against Choochmeque's `registerForPushNotifications` hanging
 * on iOS when the APNs token callback never fires (background-thread Timer bug).
 */
function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(
                () => reject(new Error(`${label} timed out after ${ms}ms`)),
                ms
            );
        }),
    ]);
}

/**
 * On iOS, registerForPushNotifications() returns a raw APNs hex token (not an FCM token).
 * Firebase's MessagingDelegate receives the FCM token asynchronously after the APNs token
 * is processed. The native FirebaseManager.swift sets `window.__frakFcmToken` and dispatches
 * a `frak:fcm-token` CustomEvent via `evaluateJavaScript` on the WKWebView.
 *
 * On Android, registerForPushNotifications() returns the FCM token directly.
 *
 * Throws on iOS if the FCM token is unavailable within the timeout — storing an APNs token
 * as "fcm" type would silently fail on backend dispatch. The token refresh listener will
 * handle eventual delivery when Firebase completes the APNs→FCM exchange.
 */
async function getFcmToken(apnsOrFcmToken: string): Promise<string> {
    if (!isIOS()) {
        return apnsOrFcmToken;
    }

    // Check if Firebase has already delivered the FCM token via evaluateJavaScript
    if (window.__frakFcmToken) {
        return window.__frakFcmToken;
    }

    // Wait for the FCM token from Firebase's MessagingDelegate
    return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
            window.removeEventListener("frak:fcm-token", handler);
            reject(new Error("FCM token not received within timeout"));
        }, 10_000);

        const handler = (event: CustomEvent<{ token: string }>) => {
            clearTimeout(timeout);
            window.removeEventListener("frak:fcm-token", handler);
            resolve(event.detail.token);
        };

        window.addEventListener("frak:fcm-token", handler);
    });
}

export function createTauriNotificationAdapter(): NotificationAdapter {
    let permissionGranted = false;
    let hasPushTokenListener = false;

    const syncTokenToBackend = async (token: string) => {
        await authenticatedWalletApi.notifications.tokens.put({
            type: "fcm" as const,
            token,
        });
    };

    const ensurePushTokenListener = async () => {
        if (hasPushTokenListener) {
            return;
        }

        try {
            // On iOS, listen for FCM token updates from native FirebaseManager.swift
            // (delivered via evaluateJavaScript → CustomEvent on window)
            if (isIOS()) {
                window.addEventListener("frak:fcm-token", (event) => {
                    syncTokenToBackend(event.detail.token).catch((error) => {
                        console.warn(
                            "Failed to sync refreshed FCM token to backend",
                            error
                        );
                    });
                });
            }

            // On Android, listen for push token refreshes from the notifications plugin
            // (which already returns FCM tokens directly)
            if (isAndroid()) {
                await addPluginListener(
                    "notifications",
                    "push-token",
                    (event: { token: string }) => {
                        syncTokenToBackend(event.token).catch((error) => {
                            console.warn(
                                "Failed to sync refreshed push token to backend",
                                error
                            );
                        });
                    }
                );
            }

            hasPushTokenListener = true;
        } catch (error) {
            console.warn("Failed to register push token listener", error);
        }
    };

    const adapter: NotificationAdapter = {
        isSupported: () => true,
        getPermissionStatus: () => (permissionGranted ? "granted" : "default"),
        requestPermission: async () => {
            try {
                const plugin = await getTauriNotificationPlugin();
                if (!plugin) return "denied";
                const result = await plugin.requestPermission();
                // Choochmeque's Swift resolves with { permissionState: "granted" }
                // (an object), not the string "granted". Handle both shapes.
                const state =
                    typeof result === "string"
                        ? result
                        : (result as { permissionState?: string })
                              ?.permissionState;
                permissionGranted = state === "granted";
                return permissionGranted ? "granted" : "denied";
            } catch {
                return "denied";
            }
        },
        subscribe: async () => {
            const permission = await adapter.requestPermission();
            if (permission !== "granted") {
                return;
            }

            const plugin = await getTauriNotificationPlugin();
            if (!plugin) {
                return;
            }

            // Set up token refresh listener BEFORE registration so we don't
            // miss the first FCM token event from Firebase's MessagingDelegate
            await ensurePushTokenListener();

            // Clear any stale native FCM registration before re-registering.
            // The Choochmeque plugin hangs on Android if registerForPushNotifications()
            // is called when a previous registration is still active (e.g. after
            // reinstall, backend token expiry, or data wipe).
            try {
                await withTimeout(
                    plugin.unregisterForPushNotifications(),
                    5_000,
                    "unregisterForPushNotifications (pre-cleanup)"
                );
            } catch {
                // Ignore — no prior registration to clean up
            }

            // registerForPushNotifications returns FCM token on Android,
            // raw APNs hex token on iOS — getFcmToken handles the exchange.
            //
            // Timeout guard: Choochmeque's iOS impl creates a Timer on a
            // background thread (UNUserNotificationCenter callback) whose
            // RunLoop never runs — so the invoke can hang forever if the
            // APNs token callback doesn't fire. 15 s is generous enough for
            // real devices while preventing infinite hangs.
            let rawToken: string;
            try {
                rawToken = await withTimeout(
                    plugin.registerForPushNotifications(),
                    15_000,
                    "registerForPushNotifications"
                );
            } catch (error) {
                console.warn(
                    "registerForPushNotifications failed (simulator / timeout?)",
                    error
                );
                return;
            }
            const token = await getFcmToken(rawToken);
            await withTimeout(
                syncTokenToBackend(token),
                10_000,
                "syncTokenToBackend"
            );
        },
        unsubscribe: async () => {
            permissionGranted = false;
            const plugin = await getTauriNotificationPlugin();
            if (plugin) {
                await plugin.unregisterForPushNotifications();
            }

            try {
                await authenticatedWalletApi.notifications.tokens.delete();
            } catch (error) {
                console.warn("Failed to delete push token from backend", error);
            }
        },
        isSubscribed: async () => {
            try {
                const result =
                    await authenticatedWalletApi.notifications.tokens.hasAny.get();
                return result.data ?? false;
            } catch (error) {
                console.warn("Failed to fetch push subscription status", error);
                return false;
            }
        },
        initialize: async () => {
            try {
                const plugin = await getTauriNotificationPlugin();
                if (!plugin) return { isSubscribed: false };
                const granted = await plugin.isPermissionGranted();
                permissionGranted = granted;

                if (granted) {
                    await ensurePushTokenListener();
                }

                if (isAndroid()) {
                    await plugin.createChannel({
                        id: "default",
                        name: "Frak Wallet",
                        importance: 4,
                    });
                }

                return { isSubscribed: await adapter.isSubscribed() };
            } catch {
                return { isSubscribed: false };
            }
        },
        showLocalNotification: async (payload: NotificationPayload) => {
            try {
                const plugin = await getTauriNotificationPlugin();
                if (plugin) {
                    await plugin.sendNotification({
                        title: payload.title,
                        body: payload.body,
                        icon: payload.icon,
                    });
                }
            } catch (error) {
                console.warn("Failed to send Tauri notification", error);
            }

            await notificationStorage.add({
                id: crypto.randomUUID(),
                title: payload.title,
                body: payload.body,
                icon: payload.icon,
                data: payload.data,
                timestamp: Date.now(),
            });
        },
    };

    return adapter;
}
