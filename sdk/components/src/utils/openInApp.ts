import {
    AUTH_STATE_KEY,
    computeLegacyProductId,
    DEEP_LINK_SCHEME,
    trackEvent,
} from "@frak-labs/core-sdk";

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

/**
 * Generate cryptographically secure state for CSRF protection
 */
function generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Open the Frak Wallet mobile app with login flow
 * Stores CSRF state and redirects to app with returnUrl
 *
 * @param merchantId - Merchant ID (if not provided, computed from domain)
 */
export function openFrakWalletLogin(merchantId?: string): void {
    if (window.FrakSetup?.client) {
        trackEvent(window.FrakSetup.client, "open_in_app_login_clicked");
    }

    // Generate and store CSRF state
    const state = generateState();
    localStorage.setItem(AUTH_STATE_KEY, state);

    // Resolve merchantId
    const resolvedMerchantId =
        merchantId ?? computeLegacyProductId(window.FrakSetup?.client?.config);

    // Build login URL
    const params = new URLSearchParams();
    params.set("returnUrl", window.location.href);
    params.set("productId", resolvedMerchantId);
    params.set("state", state);

    window.location.href = `${DEEP_LINK_SCHEME}login?${params.toString()}`;
}
