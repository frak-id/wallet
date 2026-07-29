import type { FrakClient, OpenSsoArgsType, OpenSsoReturnType } from "../types";
import { prepareSsoUrl, withDirectExitDefault } from "./prepareSsoUrl";

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
 * - Opens the popup, then waits for SSO completion via postMessage
 *
 * Pass `{ ssoUrl }` from
 * {@link @frak-labs/core-sdk!actions.prepareSsoUrl | `prepareSsoUrl()`} to open
 * the popup without awaiting anything first — see the popup-blocker note below.
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
 * ```ts [Pre-built URL]
 * // Prepared ahead of the click, so the popup opens synchronously
 * const { ssoUrl } = await prepareSsoUrl(frakConfig, { metadata });
 * // ...later, directly in the click handler:
 * await openSso(frakConfig, { ssoUrl });
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
    inputArgs: OpenSsoArgsType
): Promise<OpenSsoReturnType> {
    const { metadata, customizations } = client.config;

    // Pre-built URL: open first, resolve nothing. This is the whole point of
    // the `prepareSsoUrl()` form — every await below runs after the popup is
    // already on screen, so no blocker heuristic can fire.
    if ("ssoUrl" in inputArgs) {
        openSsoPopup(inputArgs.ssoUrl);
        const result = await client.request({
            method: "frak_openSso",
            params: [{}, metadata.name, customizations?.css],
        });
        return result ?? {};
    }

    const args = withDirectExitDefault(inputArgs);

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

    // Popup flow: build the URL, then open.
    //
    // window.open() does NOT run in the same tick as the user gesture here —
    // resolving the ids and signing the proof are all awaits. They are cache
    // hits in the common case, so the popup usually opens fast enough, and a
    // blocked first click generally succeeds on the second (the ids are cached
    // by then). To remove the risk entirely rather than shrink it, prepare the
    // URL ahead of the gesture with `prepareSsoUrl()` and pass `{ ssoUrl }`.
    const ssoUrl =
        args.ssoPopupUrl ?? (await prepareSsoUrl(client, args)).ssoUrl;

    openSsoPopup(ssoUrl);

    // Wait for SSO completion via RPC
    // The wallet iframe will resolve this when SSO page sends sso_complete message
    const result = await client.request({
        method: "frak_openSso",
        params: [args, metadata.name, customizations?.css],
    });

    return result ?? {};
}

/**
 * Open the SSO popup, throwing the blocker error the callers expect.
 */
function openSsoPopup(ssoUrl: string) {
    const popup = window.open(ssoUrl, ssoPopupName, ssoPopupFeatures);
    if (!popup) {
        throw new Error(
            "Popup was blocked. Please allow popups for this site."
        );
    }
    popup.focus();
}
