import type { Address, Hex } from "viem";

/**
 * Global open panel properties
 */
export type AnalyticsGlobalProperties = {
    // Global
    wallet?: Address;
    isIframe: boolean;
    isPwa: boolean;
    // Pass a custom iframe referrer (since the event referrer could be overridden if user got multiple websites using frak open, see: https://github.com/Openpanel-dev/openpanel/issues/172)
    iframeReferrer: string;
    // Embedded specifics
    productId: Hex;
    contextUrl: string;
    contextReferrer?: Address;
};

/**
 * Different types of authentication events
 */
export type AnalyticsAuthenticationType =
    | "register"
    | "login"
    | "sso"
    | "pairing"
    | "demo";
