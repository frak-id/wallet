import type {
    FrakClient,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
} from "../types";

/**
 * Ask the wallet iframe for an SSO URL without opening the popup, so the
 * caller can inspect or extend it before opening it itself.
 *
 * @param client - The current Frak Client
 * @param args - The SSO parameters
 * @returns Object containing the generated ssoUrl
 *
 * @example
 * ```ts
 * const { ssoUrl } = await prepareSso(client, {
 *   metadata: { logoUrl: "..." },
 *   directExit: true
 * });
 * await openSso(client, {
 *   metadata: { logoUrl: "..." },
 *   ssoPopupUrl: `${ssoUrl}&tracking=abc123`,
 * });
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
