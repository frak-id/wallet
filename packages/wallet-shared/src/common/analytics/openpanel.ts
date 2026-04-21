import {
    isAndroid,
    isIOS,
    isTauri,
} from "@frak-labs/app-essentials/utils/platform";
import { OpenPanel } from "@openpanel/web";
import { isStandalonePWA } from "ua-parser-js/helpers";
import { isInIframe } from "../lib/inApp";

export function getPlatformInfo() {
    const tauri = isTauri();
    return {
        isTauri: tauri,
        platform: tauri
            ? isIOS()
                ? "ios"
                : isAndroid()
                  ? "android"
                  : "unknown"
            : "web",
    } as const;
}

/**
 * OpenPanel singleton for the wallet + listener apps.
 * Returns undefined when env vars are missing so callers can no-op safely.
 * The SDK keeps its own OpenPanel instance (see `sdk/core/src/utils/trackEvent.ts`).
 */
export const openPanel =
    process.env.OPEN_PANEL_API_URL && process.env.OPEN_PANEL_WALLET_CLIENT_ID
        ? new OpenPanel({
              apiUrl: process.env.OPEN_PANEL_API_URL,
              clientId: process.env.OPEN_PANEL_WALLET_CLIENT_ID,
              trackScreenViews: true,
              trackOutgoingLinks: true,
              trackAttributes: false,
              // Hacky but effective: force-merge init props on the first event
              // that slips through before `updateGlobalProperties` runs.
              filter: ({ type, payload }) => {
                  if (type !== "track") return true;
                  if (!payload?.properties) return true;
                  if (!("isIframe" in payload.properties)) {
                      payload.properties = {
                          ...payload.properties,
                          ...getInitProperties(),
                      };
                  }
                  return true;
              },
          })
        : undefined;

function getIsStandalonePwa() {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    ) {
        return false;
    }
    try {
        return isStandalonePWA();
    } catch {
        return false;
    }
}

export function getInitProperties() {
    if (typeof window === "undefined") return {};
    const referrer =
        isInIframe && document.referrer !== "" ? document.referrer : undefined;
    return {
        isIframe: isInIframe,
        isPwa: getIsStandalonePwa(),
        iframeReferrer: referrer,
        ...getPlatformInfo(),
    };
}
