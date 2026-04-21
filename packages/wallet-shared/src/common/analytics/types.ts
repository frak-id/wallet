import type { Address, Hex } from "viem";

/**
 * Global open panel properties
 */
export type AnalyticsGlobalProperties = {
    // Global
    wallet?: Address;
    isIframe: boolean;
    isPwa: boolean;
    isTauri?: boolean;
    platform?: "ios" | "android" | "web" | "unknown";
    // Pass a custom iframe referrer (since the event referrer could be overridden if user got multiple websites using frak open, see: https://github.com/Openpanel-dev/openpanel/issues/172)
    iframeReferrer?: string;
    // Embedded specifics
    productId?: Hex;
    contextUrl?: string;
    // Session / build / locale — added in the tagging plan Phase 1
    session_id?: string;
    app_version?: string;
    locale?: string;
    has_biometrics?: boolean;
    install_source?: string;
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
