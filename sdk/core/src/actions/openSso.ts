import type { FrakClient, OpenSsoParamsType } from "../types";

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
 *     links: {
 *         confidentialityLink: "https://my-app.com/confidentiality",
 *         helpLink: "https://my-app.com/help",
 *         cguLink: "https://my-app.com/cgu",
 *     },
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
 *     redirectUrl: "https://my-app.com/nexus-sso",
 *     metadata,
 * });
 * ```
 * :::
 */
export async function openSso(
    client: FrakClient,
    args: OpenSsoParamsType
): Promise<void> {
    const { metadata } = client.config;
    await client.request({
        method: "frak_sso",
        params: [args, metadata.name, metadata.css],
    });
}
