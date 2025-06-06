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

export async function trackAuthInitiated(
    event: AnalyticsAuthenticationType,
    args?: {
        method: "global" | "specific";
    }
) {
    if (!openPanel) return;
    await openPanel.track(`${event}_initiated`, args);
}

export async function trackAuthCompleted(
    event: AnalyticsAuthenticationType,
    wallet: Omit<Session, "token">
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
        // Track the event
        openPanel.track(`${event}_completed`),
    ]);
}

export async function trackAuthFailed(
    event: AnalyticsAuthenticationType,
    reason: string
) {
    if (!openPanel) return;
    openPanel.track(`${event}_failed`, {
        reason,
    });
}

export async function trackGenericEvent(
    event: string,
    params?: Record<string, unknown>
) {
    if (!openPanel) return;
    await openPanel.track(event, params);
}
