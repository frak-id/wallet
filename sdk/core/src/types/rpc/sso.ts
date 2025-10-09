import type { Hex } from "viem";

/**
 * SSO Metadata
 */
export type SsoMetadata = {
    /**
     * URL to your client, if provided will be displayed in the SSO header
     */
    logoUrl?: string;
    /**
     * Link to your homepage, if referenced your app name will contain a link on the sso page
     */
    homepageLink?: string;
};

/**
 * Params for preparing SSO (generating URL)
 * Same as OpenSsoParamsType but without openInSameWindow (popup-only operation)
 * @group RPC Schema
 */
export type PrepareSsoParamsType = {
    /**
     * Redirect URL after the SSO (optional)
     */
    redirectUrl?: string;
    /**
     * If the SSO should directly exit after completion
     * @defaultValue true
     */
    directExit?: boolean;
    /**
     * Language of the SSO page (optional)
     * It will default to the current user language (or "en" if unsupported language)
     */
    lang?: "en" | "fr";
    /**
     * Custom SSO metadata
     */
    metadata?: SsoMetadata;
};

/**
 * Response after preparing SSO
 * @group RPC Schema
 */
export type PrepareSsoReturnType = {
    /**
     * The SSO URL that should be opened in a popup
     */
    ssoUrl: string;
};

/**
 * Response after an SSO has been openned
 */
export type OpenSsoReturnType = {
    /**
     * Optional wallet address, returned when SSO completes via postMessage
     * Note: Only present when SSO flow completes (not immediately on open)
     */
    wallet?: Hex;
};

/**
 * Params to start a SSO
 * @group RPC Schema
 */
export type OpenSsoParamsType = PrepareSsoParamsType & {
    /**
     * Indicate whether we want todo the flow within the same window context, or if we want to do it with an external popup window openned
     * Note: Default true if redirectUrl is present, otherwise, false
     */
    openInSameWindow?: boolean;

    /**
     * Custom SSO popup url if user want additionnal customisation
     */
    ssoPopupUrl?: string;
};
