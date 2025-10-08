import type {
    FrakClient,
    OpenSsoParamsType,
    OpenSsoReturnType,
} from "../types";

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
    const { metadata, customizations } = client.config;
    const result = await client.request({
        method: "frak_sso",
        params: [args, metadata.name, customizations?.css],
    });
    return result ?? {};
}
