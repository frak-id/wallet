import type {
    FrakClient,
    OpenSsoParamsType,
    OpenSsoReturnType,
} from "../types";

// SSO popup configuration
export const ssoPopupFeatures =
    "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
export const ssoPopupName = "frak-sso";

/**
 * Function used to open the SSO
 * @param client - The current Frak Client
 * @param args - The SSO parameters
 *
 * @description This function uses a two-step flow to open SSO:
 * 1. Prepare SSO URL via RPC (frak_prepareSso)
 * 2. Open popup with URL (in same tick - no popup blocker!)
 * 3. Trigger SSO via RPC (frak_triggerSso) - returns when complete
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
 * ```ts [Direct exit]
 * // Trigger an sso opening with redirection
 * await openSso(frakConfig, {
 *     directExit: true,
 *     metadata,
 * });
 * ```
 * ```ts [Redirection]
 * // Trigger an sso opening within a popup with direct exit
 * await openSso(frakConfig, {
 *     redirectUrl: "https://my-app.com/frak-sso",
 *     metadata,
 * });
 * ```
 * ```ts [With tracking]
 * // Trigger an sso with consumeKey for tracking
 * const result = await openSso(frakConfig, {
 *     directExit: true,
 *     generateConsumeKey: true,
 *     metadata,
 * });
 * console.log(result.consumeKey); // Use this to track SSO status
 * ```
 * :::
 */
export async function openSso(
    client: FrakClient,
    args: OpenSsoParamsType
): Promise<OpenSsoReturnType> {
    const { metadata, customizations } = client.config;

    // Check if redirect mode
    if (args.openInSameWindow) {
        // Redirect flow: Single RPC call handles everything
        // This will generate URL and trigger redirect via lifecycle event
        return await client.request({
            method: "frak_openSso",
            params: [args, metadata.name, customizations?.css],
        });
    }

    // Popup flow: Two-step process
    // Step 1: Open popup with URL (same tick = no popup blocker!)
    const popup = window.open(args.ssoPopupUrl, ssoPopupName, ssoPopupFeatures);
    if (!popup) {
        throw new Error(
            "Popup was blocked. Please allow popups for this site."
        );
    }
    popup.focus();

    // Step 2: Wait for SSO completion
    // This returns when the SSO page sends sso_complete to wallet iframe
    const result = await client.request({
        method: "frak_openSso",
        params: [args, metadata.name, customizations?.css],
    });

    return result ?? {};
}
