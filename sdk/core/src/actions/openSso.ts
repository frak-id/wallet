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
 * @description This function will open the SSO with the provided parameters.
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
    const { metadata, customizations, walletUrl } = client.config;

    // Build the popup url and open it
    const url = new URL(walletUrl ?? "https://wallet.frak.id");
    const popupUrl = `${url.origin}/sso-popup`;
    const openedWindow = window.open(popupUrl, ssoPopupName, ssoPopupFeatures);
    if (!openedWindow) {
        throw new Error(
            "Popup was blocked. Please allow popups for this site."
        );
    }
    openedWindow.focus();

    // Make RPC request - the wallet handler will wait for popup to be ready
    const result = await client.request({
        method: "frak_sso",
        params: [args, metadata.name, customizations?.css],
    });
    return result ?? {};
}
