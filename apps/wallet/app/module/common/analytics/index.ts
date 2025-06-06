import { OpenPanel } from "@openpanel/web";
import type { Session } from "../../../types/Session";
import type {
    AnalyticsAuthenticationType,
    AnalyticsGlobalProperties,
} from "./types";

/**
 * Create the open panel instance if the env variables are set
 */
export const openPanel =
    process.env.OPEN_PANEL_API_URL && process.env.OPEN_PANEL_WALLET_CLIENT_ID
        ? new OpenPanel({
              apiUrl: process.env.OPEN_PANEL_API_URL,
              clientId: process.env.OPEN_PANEL_WALLET_CLIENT_ID,
              trackScreenViews: true,
              trackOutgoingLinks: true,
              trackAttributes: false,
          })
        : undefined;

export function initOpenPanel() {
    if (!openPanel) return;

    openPanel.init();

    if (typeof window === "undefined") return;
    const isIframe = window.self !== window.top;
    const isPwa = window.matchMedia("(display-mode: standalone)").matches;
    updateGlobalProperties({
        isIframe,
        isPwa,
    });
}

/**
 * Update the global properties of the open panel
 * @param properties - The properties to update
 */
export function updateGlobalProperties(
    properties: Partial<AnalyticsGlobalProperties>
) {
    if (!openPanel) return;
    const current = openPanel.global ?? {};
    openPanel.setGlobalProperties({
        ...current,
        ...properties,
    });
}

/**
 * Track the authentication initiated event
 */
export async function trackAuthInitiated(
    event: AnalyticsAuthenticationType,
    args?: {
        method?: "global" | "specific";
        ssoId?: string;
    }
) {
    if (!openPanel) return;
    await openPanel.track(`${event}_initiated`, args);
}

/**
 * Track the authentication completed event
 */
export async function trackAuthCompleted(
    event: AnalyticsAuthenticationType,
    wallet: Omit<Session, "token">,
    args?: {
        ssoId?: string;
    }
) {
    if (!openPanel) return;
    updateGlobalProperties({
        wallet: wallet.address,
    });
    await Promise.allSettled([
        // Identify the user
        await openPanel.identify({
            profileId: wallet.address,
            properties: {
                sessionType: wallet.type ?? "webauthn",
                sessionSrc: "pairing",
            },
        }),
        // Track the auth related event
        openPanel.track(`${event}_completed`, args),
        // Track another event to tell that the user is logged in
        openPanel.track("user_logged_in"),
    ]);
}

/**
 * Track the authentication failed event
 */
export async function trackAuthFailed(
    event: AnalyticsAuthenticationType,
    reason: string,
    args?: {
        ssoId?: string;
    }
) {
    if (!openPanel) return;
    openPanel.track(`${event}_failed`, {
        ...args,
        reason,
    });
}

/**
 * Track generic events
 */
export async function trackGenericEvent(
    event: string,
    params?: Record<string, unknown>
) {
    if (!openPanel) return;
    await openPanel.track(event, params);
}
