import { trackEvent } from "@frak-labs/core-sdk";

const DEEP_LINK_SCHEME = "frakwallet://";
const DEFAULT_PATH = "wallet";

/**
 * Open the Frak Wallet mobile app via deep link
 * Triggers "open_in_app_clicked" tracking event
 *
 * @param path - Path to open in the app (default: "wallet")
 */
export function openFrakWalletApp(path: string = DEFAULT_PATH): void {
    if (window.FrakSetup?.client) {
        trackEvent(window.FrakSetup.client, "open_in_app_clicked");
    }
    window.location.href = `${DEEP_LINK_SCHEME}${path}`;
}
