import type {
    FrakClient,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
} from "../types";

// SSO popup configuration
export const ssoPopupFeatures =
    "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
export const ssoPopupName = "frak-sso";

/**
 * Generate SSO URL without opening popup
 *
 * This is a **synchronous**, client-side function that generates the SSO URL
 * without any RPC calls to the wallet iframe. Use this when you need:
 * - Custom URL modifications before opening popup
 * - Pre-generation for advanced popup strategies
 * - URL inspection/logging before SSO flow
 *
 * @param client - The current Frak Client
 * @param args - The SSO parameters
 * @returns Object containing the generated ssoUrl
 *
 * @example
 * ```ts
 * // Generate URL for inspection
 * const { ssoUrl } = prepareSso(client, {
 *   metadata: { logoUrl: "..." },
 *   directExit: true
 * });
 * console.log("Opening SSO:", ssoUrl);
 *
 * // Add custom params
 * const customUrl = `${ssoUrl}&tracking=abc123`;
 * await openSso(client, { metadata, ssoPopupUrl: customUrl });
 * ```
 *
 * @remarks
 * For most use cases, just use `openSso()` which handles URL generation automatically.
 * Only use `prepareSso()` when you need explicit control over the URL.
 */
export async function prepareSso(
    client: FrakClient,
    args: PrepareSsoParamsType
): Promise<PrepareSsoReturnType> {
    const { metadata, customizations } = client.config;

    return await client.request({
        method: "frak_prepareSso",
        params: [args, metadata.name, customizations?.css],
    });
}
