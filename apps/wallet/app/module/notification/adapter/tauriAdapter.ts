import { authenticatedWalletApi, getInvoke } from "@frak-labs/wallet-shared";
import type { PluginListener } from "@tauri-apps/api/core";
import i18next from "i18next";
import type { PermissionState } from "tauri-plugin-fcm";
import type {
    NotificationAdapter,
    NotificationPermissionStatus,
    PushTokenPayload,
} from "./adapter";

const FCM_TOKEN_DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Lazy-loaded handle to the `tauri-plugin-fcm` runtime API.
 *
 * The static import bleeds the FCM SDK into the web bundle even though it's
 * only ever invoked inside Tauri mobile. Memoize the dynamic import so the
 * module graph is walked at most once.
 */
type FcmModule = typeof import("tauri-plugin-fcm");
let fcmPromise: Promise<FcmModule> | null = null;
function getFcm(): Promise<FcmModule> {
    if (!fcmPromise) fcmPromise = import("tauri-plugin-fcm");
    return fcmPromise;
}

function mapPermission(state: PermissionState): NotificationPermissionStatus {
    if (state === "granted") return "granted";
    if (state === "denied") return "denied";
    if (state === "prompt-with-rationale") return "prompt-with-rationale";
    return "prompt";
}

export function createTauriNotificationAdapter(): NotificationAdapter {
    let tokenRefreshListener: PluginListener | undefined;
    let pendingTokenResolve: ((token: string) => void) | undefined;
    let earlyToken: string | undefined;
    const events = new EventTarget();

    const syncTokenToBackend = async (token: string) => {
        await authenticatedWalletApi.notifications.tokens.put({
            type: "fcm" as const,
            token,
            locale: i18next.language?.split("-")[0],
        });
    };

    const handleTokenRefresh = (event: { token: string }) => {
        earlyToken = event.token;
        const payload: PushTokenPayload = { type: "fcm", token: event.token };
        events.dispatchEvent(
            new CustomEvent("token-update", { detail: payload })
        );
        if (pendingTokenResolve) {
            pendingTokenResolve(event.token);
            pendingTokenResolve = undefined;
            return;
        }
        syncTokenToBackend(event.token).catch((error) => {
            console.warn(
                "Failed to sync refreshed FCM token to backend",
                error
            );
        });
    };

    const setupTokenRefreshListener = async (): Promise<boolean> => {
        if (tokenRefreshListener !== undefined) return true;
        try {
            const fcm = await getFcm();
            tokenRefreshListener = await fcm.onTokenRefresh(handleTokenRefresh);
            return true;
        } catch (error) {
            console.warn("FCM token refresh listener unavailable:", error);
            return false;
        }
    };

    const teardownTokenRefreshListener = async () => {
        if (tokenRefreshListener) {
            await tokenRefreshListener.unregister();
            tokenRefreshListener = undefined;
        }
    };

    const obtainToken = async (): Promise<string> => {
        try {
            const fcm = await getFcm();
            const response = await fcm.getToken();
            if (response.token) return response.token;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (!msg.includes("FCM token not available")) {
                throw error;
            }
        }

        if (earlyToken) {
            const token = earlyToken;
            earlyToken = undefined;
            return token;
        }

        return new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingTokenResolve = undefined;
                reject(new Error("FCM token delivery timed out"));
            }, FCM_TOKEN_DELIVERY_TIMEOUT_MS);
            pendingTokenResolve = (t: string) => {
                clearTimeout(timer);
                resolve(t);
            };
        });
    };

    const initPromise: Promise<void> = (async () => {
        try {
            const fcm = await getFcm();
            await fcm.createChannel({
                id: "default",
                name: "Frak Wallet",
                importance: 4,
            });
            await setupTokenRefreshListener();
        } catch (error) {
            console.warn("Tauri notification init failed:", error);
        }
    })();

    const adapter: NotificationAdapter = {
        initPromise,

        getPermissionStatus: async () => {
            try {
                const fcm = await getFcm();
                const state = await fcm.checkPermissions();
                return mapPermission(state);
            } catch {
                return "prompt";
            }
        },

        requestPermission: async () => {
            const fcm = await getFcm();
            // Check the current permission, if granted, early exit
            const current = await fcm.checkPermissions();
            if (current === "granted") return mapPermission(current);

            const state = await fcm.requestPermissions();
            return mapPermission(state);
        },

        getToken: async () => {
            await initPromise;

            try {
                const token = await obtainToken();
                return { type: "fcm", token: token };
            } catch (e) {
                console.warn("Unable to obtain notification token", e);
                return null;
            }
        },

        subscribe: async () => {
            await initPromise;

            const permission = await adapter.requestPermission();
            if (permission !== "granted") {
                throw new Error(
                    `Notification permission ${permission}: user denied or dismissed the prompt`
                );
            }

            earlyToken = undefined;
            await setupTokenRefreshListener();
            const fcm = await getFcm();
            await fcm.register();

            const token = await obtainToken();

            return { type: "fcm" as const, token };
        },

        unsubscribe: async () => {
            await teardownTokenRefreshListener();

            try {
                const fcm = await getFcm();
                await fcm.deleteToken();
            } catch (error) {
                console.warn("Failed to delete FCM token", error);
            }
        },

        openSettings: async () => {
            const { isAndroid } = await import(
                "@frak-labs/app-essentials/utils/platform"
            );
            if (isAndroid()) {
                const invoke = await getInvoke();
                await invoke("plugin:app-settings|open_notification_settings");
            } else {
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                await openUrl("app-settings:");
            }
        },

        events,
    };

    return adapter;
}
