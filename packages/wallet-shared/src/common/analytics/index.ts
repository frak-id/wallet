import { OpenPanel } from "@openpanel/web";
import { isStandalonePWA } from "ua-parser-js/helpers";
import type { Session } from "@/types/Session";
import { isInIframe } from "../lib/inApp";
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
              // We use a filter to ensure we got the open panel instance initialized
              //  A bit hacky, but this way we are sure that we got everything needed for the first event ever sent
              filter: ({ type, payload }) => {
                  if (type !== "track") return true;
                  if (!payload?.properties) return true;

                  // Check if we we got the properties once initialized
                  if (!("isIframe" in payload.properties)) {
                      console.log("force initOpenPanel");
                      payload.properties = {
                          ...payload.properties,
                          ...getInitProperties(),
                      };
                  }

                  return true;
              },
          })
        : undefined;

/**
 * Get the properties to init open panel
 */
function getInitProperties() {
    if (typeof window === "undefined") return {};
    const referrer =
        isInIframe && document.referrer !== "" ? document.referrer : undefined;
    return {
        isIframe: isInIframe,
        isPwa: isStandalonePWA(),
        iframeReferrer: referrer,
    };
}

/**
 * Function used to init open panel
 */
function initOpenPanel() {
    if (!openPanel) return;
    openPanel.init();
    updateGlobalProperties(getInitProperties());
}
initOpenPanel();

/**
 * Set the profile id of the open panel
 */
export function setProfileId(profileId?: string) {
    if (!openPanel) return;
    openPanel.profileId = profileId;
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
        // Track the auth related event
        openPanel.track(`${event}_completed`),
        // Track another event to tell that the user is logged in
        openPanel.track("user_logged_in"),
    ]);
}

/**
 * Track the authentication failed event
 */
export async function trackAuthFailed(
    event: AnalyticsAuthenticationType,
    reason: string
) {
    if (!openPanel) return;
    openPanel.track(`${event}_failed`, {
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
