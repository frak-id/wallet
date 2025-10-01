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
 * Params to start a SSO
 * @group RPC Schema
 */
export type OpenSsoParamsType = {
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
     * If true, opens SSO in same window instead of popup
     * Defaults to true when redirectUrl is provided, false otherwise
     */
    openInSameWindow?: boolean;
    /**
     * An optional consumeKey for SSO session resolution via backend
     * Note: Used for direct SSO page ↔ wallet communication, not for RPC polling
     */
    consumeKey?: Hex;
    /**
     * Language of the SSO page (optional)
     * It will default to the current user language (or "en" if unsupported language)
     */
    lang?: "en" | "fr";
    /**
     * Custom SSO metadata
     */
    metadata: SsoMetadata;
};

/**
 * Response after an SSO has been openned
 */
export type OpenSsoReturnType = {
    /**
     * Optional tracking id, if a consumeKey was provided in the input
     * Note: This is used for backend SSO session tracking, not for RPC polling
     */
    trackingId?: Hex;
    /**
     * Optional wallet address, returned when SSO completes via postMessage
     * Note: Only present when SSO flow completes (not immediately on open)
     */
    wallet?: Hex;
};
