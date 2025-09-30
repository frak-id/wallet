import type { Hex } from "viem";
import type { WalletStatusReturnType } from "./walletStatus";

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
     * An optional consumeKey if the website want to do SSO status polling
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
     * Optionnal tracking id, if a consumeKey where provided in the input
     */
    trackingId?: Hex;
};

/**
 * Params to track an SSO status
 * @group RPC Schema
 */
export type TrackSsoParamsType = {
    /**
     * The consume key needed to track this sso
     */
    consumeKey: Hex;

    /**
     * The tracking key to track for
     */
    trackingId: Hex;
};

/**
 * Return type when tracking an SSO
 * @group RPC Schema
 */
export type TrackSsoReturnType = WalletStatusReturnType;
