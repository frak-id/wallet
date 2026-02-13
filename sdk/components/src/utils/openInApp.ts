import {
    DEEP_LINK_SCHEME,
    trackEvent,
    triggerDeepLinkWithFallback,
} from "@frak-labs/core-sdk";

const DEFAULT_PATH = "wallet";

/**
 * Open the Frak Wallet mobile app via deep link with fallback detection.
 *
 * Uses visibility-based detection to determine if the app opened.
 * If the app is not installed (page stays visible after 2.5s),
 * tracks an "app_not_installed" event.
 *
 * @param path - Path to open in the app (default: "wallet")
 */
export function openFrakWalletApp(path: string = DEFAULT_PATH): void {
    const client = window.FrakSetup?.client;

    // Track the click event
    if (client) {
        trackEvent(client, "open_in_app_clicked");
    }

    const deepLink = `${DEEP_LINK_SCHEME}${path}`;

    // Trigger deep link with fallback detection
    triggerDeepLinkWithFallback(deepLink, {
        onFallback: () => {
            // Track app not installed event
            if (client) {
                trackEvent(client, "app_not_installed");
            }
        },
    });
}
