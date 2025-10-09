import type {
    FrakClient,
    OpenSsoParamsType,
    OpenSsoReturnType,
} from "../types";
import { computeProductId } from "../utils/computeProductId";
import { generateSsoUrl } from "../utils/sso";

// SSO popup configuration
export const ssoPopupFeatures =
    "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
export const ssoPopupName = "frak-sso";

/**
 * Function used to open the SSO
 * @param client - The current Frak Client
 * @param args - The SSO parameters
 *
 * @description Two SSO flow modes:
 *
 * **Redirect Mode** (openInSameWindow: true):
 * - Wallet generates URL and triggers redirect
 * - Used when redirectUrl is provided
 *
 * **Popup Mode** (openInSameWindow: false/omitted):
 * - SDK generates URL client-side (or uses provided ssoPopupUrl)
 * - Opens popup synchronously (prevents popup blockers)
 * - Waits for SSO completion via postMessage
 *
 * @example
 * First we build the sso metadata
 * ```ts
 * // Build the metadata
 * const metadata: SsoMetadata = {
 *     logoUrl: "https://my-app.com/logo.png",
 *     homepageLink: "https://my-app.com",
 * };
 * ```
 *
 * Then, either use it with direct exit (and so user is directly redirected to your website), or a custom redirect URL
 * :::code-group
 * ```ts [Popup (default)]
 * // Opens in popup, SDK generates URL automatically
 * await openSso(frakConfig, {
 *     directExit: true,
 *     metadata,
 * });
 * ```
 * ```ts [Redirect]
 * // Opens in same window with redirect
 * await openSso(frakConfig, {
 *     redirectUrl: "https://my-app.com/frak-sso",
 *     metadata,
 *     openInSameWindow: true,
 * });
 * ```
 * ```ts [Custom popup URL]
 * // Advanced: provide custom SSO URL
 * const { ssoUrl } = await prepareSso(frakConfig, { metadata });
 * await openSso(frakConfig, {
 *     metadata,
 *     ssoPopupUrl: `${ssoUrl}&custom=param`,
 * });
 * ```
 * :::
 */
export async function openSso(
    client: FrakClient,
    args: OpenSsoParamsType
): Promise<OpenSsoReturnType> {
    const { metadata, customizations, walletUrl } = client.config;

    // Check if redirect mode (default to true if redirectUrl present)
    const isRedirectMode = args.openInSameWindow ?? !!args.redirectUrl;

    if (isRedirectMode) {
        // Redirect flow: Wallet generates URL and triggers redirect via lifecycle event
        // This must happen on wallet side because only the iframe can trigger the redirect
        return await client.request({
            method: "frak_openSso",
            params: [args, metadata.name, customizations?.css],
        });
    }

    // Popup flow: Generate URL on SDK side and open synchronously
    // This ensures window.open() is called in same tick as user gesture (no popup blocker)

    // Step 1: Generate or use provided SSO URL
    const ssoUrl =
        args.ssoPopupUrl ??
        generateSsoUrl(
            walletUrl ?? "https://wallet.frak.id",
            args,
            computeProductId(),
            metadata.name,
            customizations?.css
        );

    // Step 2: Open popup synchronously (critical for popup blocker prevention)
    const popup = window.open(ssoUrl, ssoPopupName, ssoPopupFeatures);
    if (!popup) {
        throw new Error(
            "Popup was blocked. Please allow popups for this site."
        );
    }
    popup.focus();

    // Step 3: Wait for SSO completion via RPC
    // The wallet iframe will resolve this when SSO page sends sso_complete message
    const result = await client.request({
        method: "frak_openSso",
        params: [args, metadata.name, customizations?.css],
    });

    return result ?? {};
}
