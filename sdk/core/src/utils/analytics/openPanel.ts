import { OpenPanel } from "@openpanel/web";
import { createPostHogMirror } from "./postHogMirror";

/**
 * Build the SDK's OpenPanel instance, or `undefined` when the build carries no
 * OpenPanel credentials. Needs no `FrakClient`, so a failed init can report too.
 * @ignore
 */
export function createSdkOpenPanel(
    clientId: string | undefined
): OpenPanel | undefined {
    if (
        !process.env.OPEN_PANEL_API_URL ||
        !process.env.OPEN_PANEL_SDK_CLIENT_ID
    ) {
        return undefined;
    }

    const identity = {
        sdk_version: process.env.SDK_VERSION,
        ...(clientId && {
            user_anonymous_client_id: clientId,
            __deviceId: clientId,
        }),
    };

    // The `POSTHOG_HOST` test lets the bundler drop the mirror when it is off.
    const postHogMirror = process.env.POSTHOG_HOST
        ? createPostHogMirror(
              process.env.POSTHOG_HOST,
              process.env.POSTHOG_TOKEN
          )
        : undefined;

    const openPanel = new OpenPanel({
        apiUrl: process.env.OPEN_PANEL_API_URL,
        clientId: process.env.OPEN_PANEL_SDK_CLIENT_ID,
        // Off on a merchant's page: `sdk_initialized` already counts page
        // loads, component impressions are the CTA denominator, and both
        // auto-trackers collect the merchant's own traffic, not ours.
        trackScreenViews: false,
        trackOutgoingLinks: false,
        // Never enable: `data-track` would let partner markup name events
        // and ship arbitrary `data-*` values into our project.
        trackAttributes: false,
        // Stamps events sent before the global properties below are applied.
        filter: ({ type, payload }) => {
            if (type !== "track") return true;
            if (!payload?.properties) return true;
            if (!("sdk_version" in payload.properties)) {
                payload.properties = { ...payload.properties, ...identity };
            }
            postHogMirror?.(payload);
            return true;
        },
    });
    // `__deviceId` overrides OpenPanel's project + IP + user-agent device
    // hash, which rotates daily and collides behind shared egress. Keying on
    // the SDK's own persistent id lets a funnel cross into the iframe and wallet.
    openPanel.setGlobalProperties(identity);
    openPanel.init();
    return openPanel;
}
